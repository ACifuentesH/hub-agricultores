import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";

/**
 * Orquesta la sincronización con Saturno (docs/SINCRONIZACION_SATURNO.md):
 * baja los volcados JSON del bucket S3 `test` (proyecto nwouogywyofnvxsgjttd,
 * credenciales en Vault vía saturno_config()) y los reenvía por lotes de 500
 * filas a public.saturno_ingerir(tabla, filas, volcado), que traduce nombres
 * de columna y hace upsert en el esquema saturno.*.
 *
 * Body opcional: { tablas?: string[], volcado?: string, promover?: boolean }
 * Sin body: toma el volcado más reciente, ingiere las 53 tablas, y NO
 * promueve (hay que pedirlo explícito con promover:true, o llamar aparte a
 * saturno_promover_lotes()).
 */

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 500;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

interface SaturnoConfig {
  key: string;
  secret: string;
  endpoint: string;
  bucket: string;
  region: string;
}

interface SyncRequest {
  tablas?: string[];
  volcado?: string;
  promover?: boolean;
}

function s3Client(cfg: SaturnoConfig): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
  });
}

// Nombres de archivo: YYYY-MM-DD_N_tabla.json (N = 0..3, uno por corrida diaria)
const FILE_RE = /^(\d{4}-\d{2}-\d{2}_\d+)_(.+)\.json$/;

async function listVolcados(client: S3Client, bucket: string) {
  const items: { key: string; volcado: string; tabla: string }[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) {
      const m = obj.Key?.match(FILE_RE);
      if (m) items.push({ key: obj.Key!, volcado: m[1], tabla: m[2] });
    }
    token = res.NextContinuationToken;
  } while (token);
  return items;
}

function ultimoVolcado(items: { volcado: string }[]): string | null {
  if (items.length === 0) return null;
  return items.map((i) => i.volcado).sort().at(-1)!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabase = createClient(SB_URL, SB_KEY);
  let body: SyncRequest = {};
  try {
    body = await req.json();
  } catch {
    // sin body — corrida por defecto
  }

  const { data: cfg, error: cfgErr } = await supabase.rpc("saturno_config");
  if (cfgErr || !cfg) {
    return new Response(
      JSON.stringify({ ok: false, error: `No se pudo leer saturno_config(): ${cfgErr?.message}` }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
  const config = cfg as SaturnoConfig;
  const client = s3Client(config);

  const all = await listVolcados(client, config.bucket);
  const volcado = body.volcado ?? ultimoVolcado(all);
  if (!volcado) {
    return new Response(JSON.stringify({ ok: false, error: "No hay volcados en el bucket" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!body.tablas && !body.volcado) {
    const { data: yaSync } = await supabase.rpc("saturno_ya_sincronizado", { p_volcado: volcado });
    if (yaSync) {
      return new Response(
        JSON.stringify({ ok: true, volcado, skipped: true, message: "Volcado ya ingerido" }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
  }

  let objetivo = all.filter((i) => i.volcado === volcado);
  if (body.tablas?.length) {
    const wanted = new Set(body.tablas);
    objetivo = objetivo.filter((i) => wanted.has(i.tabla));
  }

  const resultados: { tabla: string; ok: boolean; filas?: number; error?: string }[] = [];

  for (const item of objetivo) {
    try {
      const obj = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: item.key }));
      const text = await obj.Body!.transformToString();
      const parsed = JSON.parse(text);
      const filas: unknown[] = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.rows ?? [];

      for (let i = 0; i < filas.length; i += BATCH_SIZE) {
        const lote = filas.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.rpc("saturno_ingerir", {
          p_tabla: item.tabla,
          p_filas: lote,
          p_volcado: volcado,
        });
        if (error) throw new Error(error.message);
      }
      resultados.push({ tabla: item.tabla, ok: true, filas: filas.length });
    } catch (e) {
      resultados.push({ tabla: item.tabla, ok: false, error: (e as Error).message });
    }
  }

  let promovido: { ok: boolean; error?: string } | null = null;
  if (body.promover) {
    const { error } = await supabase.rpc("saturno_promover_lotes");
    promovido = { ok: !error, error: error?.message };
  }

  return new Response(
    JSON.stringify({ ok: true, volcado, tablas_procesadas: resultados.length, resultados, promovido }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
