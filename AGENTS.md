<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Programa Saturno — reglas del proyecto

Plataforma del Programa de Agricultura por Contrato (maíz blanco). El repo se
llama `agri-platform`; el **producto** se llama **Programa Saturno**. "Polar" a
secas es la empresa — no confundir ni renombrar.

## Build y despliegue

- **`npm run build` usa `--webpack` a propósito**: Turbopack rompe con Serwist.
- **Al borrar una página**, Next deja una referencia obsoleta en
  `.next/dev/types/validator.ts` y el typecheck falla. Solución: borrar `.next`
  y recompilar.
- Push a `main` despliega en Vercel. Verificar en producción mirando si cambió
  el hash del bundle CSS: `curl -s <url>/login | grep -o '/_next/static/css/[a-z0-9]*'`.

## Datos

- **La fuente de la verdad es Saturno**, no esta base. Ver
  [`docs/SINCRONIZACION_SATURNO.md`](docs/SINCRONIZACION_SATURNO.md). Antes de
  "arreglar" datos faltantes, comprobar si el hueco viene del origen.
- **Las fechas de Saturno son MM/DD/YYYY** (formato estadounidense). Usar
  siempre `public.saturno_fecha(text)`; nunca parsearlas a mano.
- **Ciclo agrícola**: `agropecuaria.ciclo` puede traer el valor combinado
  `'2025,2026'`, así que **no sirve para filtrar**. El ciclo es una elección
  explícita del usuario vía `?ciclo=` (`lib/ciclo.ts`). Además hay agricultores
  con lotes en ambos ciclos bajo la misma key.
- **Perfiles gemelos**: el mismo productor puede existir como dos agropecuarias
  (una por ciclo) con keys distintas. Por eso el selector muestra el ciclo.
- **`producto_registro` tiene columna `ciclo`**: filtrar por ella además de por
  nombre de lote, o los insumos de un año se cuelan en el otro.
- El clima es el único dato que la app captura por sí misma (WeatherLink, cron
  horario). Ver [`docs/OPERACION_PIPELINE_CLIMA.md`](docs/OPERACION_PIPELINE_CLIMA.md).

## Base de datos

- **Escrituras solo por `service_role`.** Tras el endurecimiento, las tablas son
  de solo lectura para `anon`/`authenticated`. Para escribir desde la app, crear
  un route handler que verifique el rol y use `createServiceClient()` — no
  aflojar RLS. Ejemplo: `app/api/lote/siembra/route.ts`.
- **La base bloquea `DELETE` sin `WHERE`.** Todo borrado dentro de funciones
  necesita condición explícita.
- Las vistas llevan `security_invoker = true` para que la RLS del usuario
  aplique. No revertirlo.
- **No cachear** las páginas de datos vivos (`export const dynamic = 'force-dynamic'`):
  el clima es dato operativo y una lectura vieja induce a error.

## Rendimiento

- **Nunca usar `DISTINCT ON` contra `weather_readings`** para obtener la última
  lectura: impide usar el índice `(station_id, ts DESC)` y obliga a escanear
  decenas de miles de filas. Usar `cross join lateral (... order by ts desc limit 1)`.
  Este cambio concreto llevó `v_clima_efectivo` de 2.374 ms a 27 ms.
- Cada ruta de `(app)` tiene su `loading.tsx` con esqueleto. Si se agrega una
  pantalla, agregar el suyo: sin él la navegación se percibe como colgada.

## PWA — cuidado especial

- **El middleware NO debe interceptar `/sw.js` ni `/manifest.json`.** Si lo hace,
  el navegador recibe una redirección a `/login` en vez del archivo, el service
  worker no puede actualizarse y los usuarios que ya instalaron la PWA quedan
  servidos por un worker viejo de forma permanente. Está resuelto en el
  `matcher` de `middleware.ts`; no simplificarlo sin entender esto.
- Al renombrar o eliminar una ruta, **agregar un redirect** en `next.config.ts`:
  hay marcadores y atajos de PWA instalados apuntando a las rutas viejas.

## UI

- El título del módulo vive en la cabecera fija (`ModuloTitulo`), no en cada
  página: no volver a poner `<h1>` en las páginas o saldrá duplicado.
- El asistente (`lib/asistente.ts`) es **determinista, sin IA externa**: lee
  datos reales y responde con textos del glosario. Si no entiende, lo admite.
  No se le conecta un modelo: no hay API key y no debe inventar cifras.
- Paleta oscura: la escala `gray` de Tailwind está redefinida bajo `.dark` en
  `globals.css` para dar un carbón cálido. Cambiar esas variables afecta toda la
  app en modo oscuro.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` vive solo en `.env.local`. **Nunca commitearlo.**
- Las credenciales de terceros van en **Vault** (ver `saturno_config()`), no en
  variables de entorno ni en el repo.
- Las contraseñas de prueba de los agricultores deben rotarse antes de un
  despliegue real.
