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
- Push a `main` despliega en Vercel. Para verificar qué build está vivo, ver
  [Verificar un deploy](docs/ARQUITECTURA.md#verificar-un-deploy-sin-iniciar-sesión):
  `/sw.js` es público y lista los chunks reales del build en producción.
- **Vercel (plan Hobby) bloquea el deploy si el autor del commit no es
  colaborador del proyecto.** Los commits de Alejandro quedan en `Blocked` y su
  trabajo no sale a producción hasta que se empuja un commit encima desde la
  cuenta dueña del proyecto. No hace falta reescribir su autoría: basta con que
  el commit de cabecera sea de la cuenta dueña.

## Datos

- **La fuente de la verdad es Saturno**, no esta base. Ver
  [`docs/SINCRONIZACION_SATURNO.md`](docs/SINCRONIZACION_SATURNO.md). Antes de
  "arreglar" datos faltantes, comprobar si el hueco viene del origen.
- **Las fechas de Saturno son MM/DD/YYYY** (formato estadounidense). Usar
  siempre `public.saturno_fecha(text)`; nunca parsearlas a mano.
- **Ciclo agrícola**: el selector 2025/2026 se retiró (30-jul-2026). La app
  trabaja siempre sobre `CICLO_ACTIVO` (`lib/ciclo.ts`); `resolveCiclo()` ignora
  el parámetro de la URL a propósito, para que un enlace viejo o una versión
  cacheada en la PWA con `?ciclo=2025` no deje a nadie mirando un ciclo cerrado.
  Si alguna vez hay que volver a filtrar por año: `agropecuaria.ciclo` **no
  sirve** — puede traer el valor combinado `'2025,2026'`, que nunca iguala a
  `lote.ciclo`. Además hay agricultores con lotes en ambos ciclos bajo la misma key.
- **Perfiles gemelos**: el mismo productor puede existir como dos agropecuarias
  (una por ciclo) con keys distintas. Por eso el selector muestra el ciclo.
- **`producto_registro` tiene columna `ciclo`**: filtrar por ella además de por
  nombre de lote, o los insumos de un año se cuelan en el otro.
- El clima es el único dato que la app captura por sí misma (WeatherLink, cron
  horario). Ver [`docs/OPERACION_PIPELINE_CLIMA.md`](docs/OPERACION_PIPELINE_CLIMA.md).
- **Sin triangulación** (30-jul-2026). Con las estaciones Davis ya asignadas,
  quien no tiene estación propia ve el módulo vacío en vez de una estimación por
  IDW desde estaciones a decenas de kilómetros, que en pantalla se leía igual que
  una medición del lote. El corte está en el `CASE` de `v_clima_efectivo`
  (migración `clima_sin_triangulacion`), no en el front: la fuente se lee desde
  esa vista en varios sitios y parchear cada uno deja el riesgo de olvidar el
  siguiente. La RPC `triangulate_clima()` y las coordenadas siguen ahí, así que
  revertir es reponer una rama del `CASE`. Hoy: 42 agricultores con Davis,
  13 sin datos.

## ⚠️ Nunca cruces `saturno.*` en una vista que consuma la app

El esquema `saturno` está **cerrado a los usuarios finales** (RLS sin políticas y
sin `USAGE` para `authenticated`). Las vistas de `public` llevan
`security_invoker = true`, así que corren con los permisos de quien consulta:
**una vista que lea de `saturno.*` devuelve CERO filas a cualquier agricultor**,
aunque los datos existan.

Esto ya ocurrió: `v_lote_detalle` cruzaba `saturno.seguimiento` y
`saturno.mecanizacion_registro`, y el dashboard mostraba "0 lotes" a todos los
agricultores. Pasó desapercibido porque las pruebas se hicieron con el MCP, que
usa `service_role` y sí tiene acceso.

**Regla:** los datos derivados del espejo se materializan en tablas de `public`
con RLS propia (ver `lote_derivado`), rellenadas por
`saturno_refrescar_derivados()` dentro de la promoción.

**Al probar una vista, hazlo con permisos de agricultor, no de servicio:**

```sql
do $$ declare v_uid uuid; begin
  select user_id into v_uid from user_profiles where agricultor_key='<KEY>' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
end $$;
select count(*) from public.v_lote_detalle;  -- debe devolver los lotes de ese agricultor
```

(Ojo: tras adoptar una identidad no puedes leer el perfil de otro usuario —
prueba cada agricultor en su propia transacción.)

## Vistas que alimentan las pantallas

No consultes `public.lote` directamente para el dashboard: usa estas vistas, que
ya resuelven derivaciones que no son obvias.

- **`v_lote_detalle`** — una fila por lote con ha plan / encaladas / sembradas /
  perdidas / cosechadas, estado, fase, última visita técnica y avance del ciclo.
  - **"Ha encaladas" NO existe como columna.** Se deriva sumando la mecanización
    de tipo `Pase de encaladora` aplicada al lote.
  - **La fase viene MEDIDA EN CAMPO** (`saturno.seguimiento` → V1..V12, R1..R6),
    no calculada por días transcurridos. Es más fiable; prefiérela.
  - `avance_pct` es null para lotes sin sembrar, a propósito: no deben arrastrar
    el promedio hacia abajo.
- **`v_agricultor_resumen`** — distribución de estados, fase dominante y avance
  medio por agricultor y ciclo.

**Ojo con la cosecha**: en el ciclo activo puede no haber ningún lote cosechado.
Antes de graficar cosecha, comprueba que hay datos; si no, grafica avance de
ciclo (es lo que hace `AvanceCultivoChart`).

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
  También orienta sobre los módulos (`MODULOS` en `lib/agro-glosario.ts`): al
  agregar una pantalla, añádela ahí o el asistente no sabrá que existe.
- **Soporte: solo tickets.** El botón de WhatsApp se eliminó por decisión del
  usuario (29-jul-2026); no reintroducirlo. Quedan dos botones flotantes, ambos
  apilados a la derecha: tickets arriba (`bottom-24 right-6`) y asistente debajo
  (`bottom-6 right-6`).
- Paleta oscura: la escala `gray` de Tailwind está redefinida bajo `.dark` en
  `globals.css` para dar un carbón cálido. Cambiar esas variables afecta toda la
  app en modo oscuro.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` vive solo en `.env.local`. **Nunca commitearlo.**
- Las credenciales de terceros van en **Vault** (ver `saturno_config()`), no en
  variables de entorno ni en el repo.
- Las contraseñas de prueba de los agricultores deben rotarse antes de un
  despliegue real.
