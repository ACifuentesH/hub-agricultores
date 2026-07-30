import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createServiceClient } from './supabase/server'

/**
 * Cliente S3-compatible hacia el bucket `productorhub`, en el proyecto Supabase
 * del equipo que va a heredar esta plataforma (aún no conectado como Supabase
 * "hermano" — solo tenemos credenciales S3 de su Storage). Server-only: las
 * credenciales son secretas y nunca deben llegar al navegador, por eso este
 * módulo solo se importa desde route handlers, nunca desde un componente
 * cliente ni desde `lib/documentos.ts` (que sí es compartido con el browser).
 *
 * Credenciales en **Vault** (secreto `productorhub_s3`, leído vía la función
 * `productorhub_config()`), no en variables de entorno — mismo patrón que
 * `saturno_config()` para las credenciales S3 de Saturno (ver
 * docs/SINCRONIZACION_SATURNO.md). `productorhub_config()` solo tiene EXECUTE
 * para `service_role`, así que hace falta el cliente de servicio para leerla.
 *
 * `productorhub` es un bucket del OTRO equipo, no exclusivo de estos
 * documentos — se namespacea bajo `PREFIJO` para no pisar lo que ellos ya
 * guarden ahí.
 */
const PREFIJO = 'documentos-programa-saturno'

interface ProductorHubConfig {
  key: string
  secret: string
  endpoint: string
  bucket: string
  region: string
}

async function getConfig(): Promise<ProductorHubConfig> {
  const svc = createServiceClient()
  const { data, error } = await svc.rpc('productorhub_config')
  if (error || !data) {
    throw new Error(`No se pudo leer la config de productorhub desde Vault: ${error?.message ?? 'sin datos'}`)
  }
  return data as ProductorHubConfig
}

/** Sube un archivo al bucket `productorhub`, bajo el mismo `path` relativo que usa `analisis-suelo` acá. */
export async function subirAProductorHub(path: string, body: Buffer, contentType: string): Promise<void> {
  const config = await getConfig()
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.key,
      secretAccessKey: config.secret,
    },
  })
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: `${PREFIJO}/${path}`,
    Body: body,
    ContentType: contentType,
  }))
}
