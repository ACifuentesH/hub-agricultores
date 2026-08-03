# Integración WeatherLink — Documentación Técnica Completa

Última verificación contra la API en vivo: **30-jul-2026**.

Este documento explica **cómo entra el clima al sistema**: la API de Davis/WeatherLink,
las trampas de su formato de respuesta, y los incidentes reales que moldearon el diseño
del pipeline.

- Para **operar** el pipeline día a día (health-checks, dar de alta una estación, rotar
  la API key), ver [OPERACION_PIPELINE_CLIMA.md](OPERACION_PIPELINE_CLIMA.md).
- Para ver **dónde encaja** el clima en el resto de la plataforma, ver
  [ARQUITECTURA.md](ARQUITECTURA.md).

> **Sobre los nombres de tabla.** Este documento habla de "tabla RAW de lecturas" y
> "agregados" en abstracto porque el pipeline se construyó sobre dos proyectos Supabase
> que lo implementan igual con nombres distintos. Las equivalencias concretas están en
> la [tabla de equivalencias](#tabla-de-equivalencias-de-nombres) de la sección 2.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura general del flujo de datos](#2-arquitectura-general-del-flujo-de-datos)
3. [Mapeo de agricultores/fincas a estaciones](#3-mapeo-de-agricultoresfincas-a-estaciones)
4. [Generación de hardware por estación y estado en vivo](#4-generación-de-hardware-por-estación-y-estado-en-vivo)
5. [Casos reales documentados (incidentes)](#5-casos-reales-documentados-incidentes)
6. [La API de WeatherLink — referencia técnica](#6-la-api-de-weatherlink--referencia-técnica)
7. [El problema de las generaciones de sensores (variables)](#7-el-problema-de-las-generaciones-de-sensores-variables)
8. [Deduplicación por timestamp](#8-deduplicación-por-timestamp)
9. [Metodología de sincronización](#9-metodología-de-sincronización)
10. [Gap arquitectónico: sin auto-discovery de estaciones](#10-gap-arquitectónico-sin-auto-discovery-de-estaciones)
11. [Checklist antes de tocar este pipeline](#11-checklist-antes-de-tocar-este-pipeline)

---

## 1. Resumen ejecutivo

Cada agricultor de este proyecto tiene (en teoría) una estación meteorológica
Davis asignada, conectada vía la API v2 de WeatherLink. Esa data alimenta el
seguimiento de lluvia por lote y el módulo de predicción de cierre de año.

Durante la construcción de esta integración aparecieron tres tipos de
problemas, cada uno con causa y solución distinta — confundirlos entre sí es
lo que más tiempo hace perder:

- **Fallas reales de estación** (el sensor de verdad dejó de transmitir) —
  se confirman contra la API en vivo, no se arreglan desde el código.
- **Bugs de sincronización nuestros** (la API sí tiene el dato, nuestra base
  no) — sí se arreglan desde el código/config.
- **Variabilidad legítima de la API** (distintas generaciones de hardware
  devuelven nombres de campo distintos) — hay que programar para esto desde
  el diseño, no parchear caso por caso.

Este documento cubre los tres, con evidencia real de cada uno.

---

## 2. Arquitectura general del flujo de datos

```
WeatherLink API v2 (/v2/historic/{station_id})
        │
        ▼
tabla RAW de lecturas       ← una fila por sensor/timestamp, ya normalizada
        │
        ▼
agregados diarios/mensuales  ← suma de lluvia + conteo de lecturas por estación
        │
        ▼
vistas de consumo (seguimiento por lote, predicción, dashboards)
```

Los agregados se refrescan cada 15 minutos por cron — el frontend nunca
calcula en vivo sobre la tabla raw (ya supera el millón de filas; calcular
sobre ella directo causaba timeouts).

El campo "cantidad de lecturas por día/mes" de los agregados es también la
base del filtro de calidad de datos: si una estación reportó pocos días en
un mes, se marca como no confiable en vez de tratarse como "no llovió".

### Tabla de equivalencias de nombres

El mismo pipeline conceptual está implementado en dos proyectos Supabase. Al leer
este documento, traducir así:

| Concepto en este documento | En `agri-platform` (Programa Saturno) | En `seguimiento-lluvia-saturno` |
|---|---|---|
| Tabla RAW de lecturas | `weather_readings` | tabla propia de lecturas del proyecto |
| Tracking de sincronización | `sync_status` | equivalente propio |
| Cola de backfill histórico | `load_historic_queue` | — |
| Catálogo de estaciones | `estaciones_davis`, `v_estaciones_clima` | `estaciones_coordenadas` |
| Asignación agricultor ↔ estación | `v_clima_efectivo` (+ `mapa_productor_clima`) | `lotes_seguimiento_lluvia.station_id` |
| Agregados por lote | — (los consume vía vistas compartidas) | `vista_lluvia_diaria_lote`, `vista_lluvia_mensual_lote` |
| Identidad del agricultor | `agropecuaria.AgricultorKey` | `agricultores.id` |

El puente entre ambos mundos es `agricultor_lluvia_map` (ver
[ARQUITECTURA.md §2.3](ARQUITECTURA.md#23-seguimiento-lluvia-saturno--lluvia-por-lote)).
Las consultas SQL de la sección 3 de este documento están escritas contra el esquema
de **seguimiento-lluvia-saturno**.

---

## 3. Mapeo de agricultores/fincas a estaciones

### Con estación asignada y resolviendo correctamente (31)

| Agricultor | Finca | Código | station_id | Nombre en WeatherLink | Región |
|---|---|---|---|---|---|
| Angela Rosa Guedez Morales | Las Cupulas | P10 | 212695 | P10-Turen Las Cúpulas-Saturno | Portuguesa |
| Antonio Luis Zambrano Acuña | Camaripano | G04 | 186730 | G04-Las Mercedes-Saturno | Guárico |
| Celso Fantinel Furlanis | El Loro | G05 | 213735 | G05-La Peñita - Saturno | Aragua |
| Cesar Igor Padilla Martinez | Finca La Padillera | P16 | 235240 | P16-Saturno La Padillera | Portuguesa |
| Dennis Leonardo Alibardi Maschio | Agropecuaria Alma | P08 | 212609 | P08-Turen La Colonia-Saturno | Portuguesa |
| Elisa Bustamante | Agropecuaria Dos Caminos | P19 | 236176 | P19-Los Caminos-Saturno | Portuguesa |
| Ezequiel Jose Fontiveros Briceño | Don Fonti | P15 | 235225 | P15 Saturno Don Fonti | Portuguesa |
| Francisco Enrique González Roselli | El Apamate | G04 | 186730 | G04-Las Mercedes-Saturno | Guárico |
| Francisco Jose Márquez | Agropecuaria Juan Francisco C.A | P18 | 235418 | P18-San Francisco-Saturno | Portuguesa |
| Jose Dario Gallucci Requena | Chaguaramitas | G13 | 238407 | G13-Palmartupío-Saturno | Guárico |
| Jose Gregorio Balza Fajardo | Los Nivillos Mahomar | G06 | 213617 | G06-Mahomal-Saturno | Guárico |
| Jose Gregorio Sanchez Mendoza | La vaquera | Y04 | 235597 | Y04-La Vaquera-Saturno | Yaracuy |
| Jose Rolando Caldera Arvelaiz | San Pedro | G10 | 238339 | G10-San Pedro-Saturno | Guárico |
| Jose Rolando Caldera Rondon | La Graciosa | G11 | 238350 | G11-La Graciosa-Saturno | Guárico |
| Juan Hernández Díaz | Agropecuaria Vilereña | G14 | 241484 | G14-La Vilereña-Saturno | Aragua |
| Julio Antonio Colmenarez Mendoza | Finca La Campesina | B01 | 235263 | B01-Saturno-La Campesina | Barinas |
| Luigi Donello Tognetti | La Colina | P08 | 212609 | P08-Turen La Colonia-Saturno | Portuguesa |
| Luis Alberto Rojas Pieretti | Los Espinitos | G02 | 186669 | G02-Los Espinitos-Saturno | Guárico |
| Meiz Tohme Elchair | Buenavista | G12 | 238383 | G12-Buenavista-Saturno | Guárico |
| Milko Pagliarella Di Berardin | Santa Elena | P01 | 184921 | P01-Pajones-Saturno | Cojedes |
| Oscar Luis Murillo Zerpa | San Ramon | G01 | 185450 | G01-San Geronimo - Saturno | Guárico |
| Pedro Vicente Gomez Arvelaez | Agropecuaria Mochuelo | G09 | 238308 | G09-Mochuelo-Saturno | Guárico |
| Richard Jose Apostol Nuñez | Acentamiento campesino El rodeo | Y06 | 238060 | Y06-Radio Faro-Saturno | Yaracuy |
| Sebastian Armando Bonet Plaza | San Antonio | P06 | 212516 | P06-Esteros de Canoita-Saturno | Portuguesa |
| Tony Alejandro Pestana Perez | Finca Montes de Luna | P17 | 235347 | P17-Monte De Luna_Saturno | Portuguesa |
| Victor Ramon Oropeza Ortiz | Mayurupi | Y05 | 237976 | Y05-La Victoriana-Saturno | Yaracuy |
| Virbel Jose Griman Alfin | El manguito | Y03 | 235420 | Y03-La Fé-Saturno | Lara |
| Williams Manuel Canelon Gonzalez | La Ceiba | Y02 | 235411 | Y02-La Ceiba-Saturno | Lara |
| Yaro El Chaer | Los Galo | Y07 | 238570 | Y07-Finca Galo- Saturno | Yaracuy |

> Antonio Luis Zambrano Acuña y Francisco Enrique González Roselli comparten
> la estación G04. Dennis Leonardo Alibardi Maschio y Luigi Donello Tognetti
> comparten P08. Ambos casos son intencionales — fincas lo suficientemente
> cerca como para compartir sensor, no un error de asignación.

### Sin código de estación asignado en el sistema (5)

No es un problema de comunicación — nunca se les asignó estación.

| Agricultor | Finca |
|---|---|
| Juan Vicente Risso | Juan Hilario |
| Leoscar Machado Silveira | Finca Camilero |
| Lorena Johana Orlando Testi | Parcela 246 |
| Maria Angelica Esparragoza Salazar | El Almirante CA |
| Wolfgang Esteger Bohor | El Encanto |

### Código asignado que no existe en la API de WeatherLink (1)

| Agricultor | Finca | Código asignado |
|---|---|---|
| Henry Jose Cordones Linarez | Santa Barbara | P20 |

`P20` no corresponde a ningún `station_id` real (verificado contra el listado
completo de estaciones activas de la cuenta, `/v2/stations`). Tema de
asignación/configuración pendiente con quien gestiona las estaciones, no algo
que se resuelva desde este proyecto.

### Cómo regenerar esta tabla contra la base de datos actual

```sql
select distinct
  a.nombre as agricultor, l.unidad_produccion as finca,
  l.codigo_estacion, l.station_id, e.station_name, e.region,
  case
    when l.station_id is null then 'sin_estacion'
    when e.station_id is null then 'codigo_no_existe_en_weatherlink'
    else 'ok'
  end as estado
from lotes_seguimiento_lluvia l
join agricultores a on a.id = l.agricultor_id
left join estaciones_coordenadas e on e.station_id = l.station_id
order by estado, a.nombre;
```

---

## 4. Generación de hardware por estación y estado en vivo

Verificado llamando **directo a `/v2/historic`** para cada estación (últimas
24h) — esto es lo que la API reporta en este momento, no una lectura de
nuestras tablas derivadas. Se hace así específicamente para poder descartar
que un hueco de data sea una mala configuración nuestra antes de reportarlo
como falla de hardware.

Dos "familias" de sensores conviven en esta cuenta de WeatherLink:

- **Generación vieja** — trío `sensor_type 72` (clima + lluvia) + `3`
  (barómetro) + `507`/`505` (telemetría del dispositivo).
- **Generación nueva** — trío `sensor_type 53` (clima + lluvia) + `242`
  (barómetro) + `504` (telemetría del dispositivo).

| Agricultor | Código | station_id | Generación | Estado (últimas 24h) |
|---|---|---|---|---|
| Milko Pagliarella Di Berardin | P01 | 184921 | Vieja (72+3+507) | OK |
| Oscar Luis Murillo Zerpa | G01 | 185450 | Vieja (72+3+507) | OK |
| Victor Ramon Oropeza Ortiz | Y05 | 237976 | Vieja (72+3+507) | OK |
| Richard Jose Apostol Nuñez | Y06 | 238060 | Vieja (72+3+507) | OK |
| Angela Rosa Guedez Morales | P10 | 212695 | Nueva (53+242+504) | OK |
| Antonio Luis Zambrano Acuña / Francisco Enrique González Roselli | G04 | 186730 | Nueva (53+242+504) | OK |
| Celso Fantinel Furlanis | G05 | 213735 | Nueva (53+242+504) | OK |
| Cesar Igor Padilla Martinez | P16 | 235240 | Nueva (53+242+504) | OK |
| Dennis Leonardo Alibardi Maschio / Luigi Donello Tognetti | P08 | 212609 | Nueva (53+242+504) | OK |
| Elisa Bustamante | P19 | 236176 | Nueva (53+242+504) | OK |
| Ezequiel Jose Fontiveros Briceño | P15 | 235225 | Nueva (53+242+504) | OK |
| Francisco Jose Márquez | P18 | 235418 | Nueva (53+242+504) | OK |
| Jose Dario Gallucci Requena | G13 | 238407 | Nueva (53+242+504) | OK |
| Jose Gregorio Balza Fajardo | G06 | 213617 | Nueva (53+242+504) | OK |
| Jose Gregorio Sanchez Mendoza | Y04 | 235597 | Nueva (53+242+504) | OK |
| Jose Rolando Caldera Arvelaiz | G10 | 238339 | Nueva (53+242+504) | OK |
| Julio Antonio Colmenarez Mendoza | B01 | 235263 | Nueva (53+242+504) | OK |
| Luis Alberto Rojas Pieretti | G02 | 186669 | Nueva (53+242+504) | OK |
| Meiz Tohme Elchair | G12 | 238383 | Nueva (53+242+504) | OK |
| Sebastian Armando Bonet Plaza | P06 | 212516 | Nueva (53+242+504) | OK |
| Tony Alejandro Pestana Perez | P17 | 235347 | Nueva (53+242+504) | OK |
| Virbel Jose Griman Alfin | Y03 | 235420 | Nueva (53+242+504) | OK |
| Williams Manuel Canelon Gonzalez | Y02 | 235411 | Nueva (53+242+504) | OK |
| Yaro El Chaer | Y07 | 238570 | Nueva (53+242+504) | OK |
| Juan Hernández Díaz | G14 | 241484 | **Híbrida** (ver caso #5.3) | OK |
| **Jose Rolando Caldera Rondon** | **G11** | **238350** | Nueva (53+242+504) | **🔴 SIN DATO — ver caso #5.2** |
| **Pedro Vicente Gomez Arvelaez** | **G09** | **238308** | Nueva (53+242+504) | **🔴 SIN DATO — hallazgo nuevo, sin investigar aún** |

**Dos aprendizajes de esta verificación:**

1. La generación de hardware **no está atada a qué tan reciente es la
   estación**. Y05 y Y06 empezaron a reportar en 2026 (instalación reciente)
   pero corren la generación VIEJA de sensores. No asumir "estación nueva" =
   "hardware nuevo".
2. G09 salió con cero lecturas en las últimas 24h y no estaba en el reporte
   de alertas anterior (ese se corrió sobre meses completos). Pendiente
   confirmar en unos días si es un corte pasajero o algo más serio como G11.

---

## 5. Casos reales documentados (incidentes)

Cada uno de estos se investigó y se confirmó **contra la API en vivo**, no
se asumió por ausencia de datos en nuestra base — esa distinción es la parte
más importante de este documento.

### 5.1 Milko Pagliarella Di Berardin (P01, 184921) — caída real de ~2 meses

La estación de Milko prácticamente dejó de transmitir durante **mayo y junio
de 2026**:

- Mayo 2026: **0 de 31 días con dato**.
- Junio 2026: **2 de 30 días con dato**.
- Julio 2026: volvió a reportar con normalidad (21+ días con dato).

Confirmado llamando `/v2/historic` directo para ese rango — la API tampoco
tiene esos datos, no es que nuestra sincronización los perdiera. Es una
caída real de la estación física (~2 meses).

**Impacto en cálculos derivados:** esto casi arruina el módulo de predicción
para este agricultor. Al calcular un factor de ajuste multiplicativo
(real 2026 vs. histórico) usando junio como uno de los meses "conocidos", el
0mm de junio (falso — es ausencia de dato, no ausencia de lluvia) generó un
factor de 0.117 (un pronóstico de "va a llover 88% menos que lo normal" para
el resto del año), completamente irreal. Esto fue lo que motivó construir un
filtro de calidad (mínimo de días con lectura por mes) antes de usar
cualquier mes en cálculos de predicción — con el filtro activo, el factor de
Milko pasa a 0.59–0.72, coherente con el resto de su zona.

**Lección:** cualquier cálculo que use "lluvia del mes" como insumo (no solo
predicción — también rachas de días secos, acumulados, etc.) tiene que
filtrar primero por cantidad mínima de días con lectura, o un hueco de sensor
se disfraza de "sequía real" y contamina todo lo que dependa de ese número.

### 5.2 Jose Rolando Caldera Rondon (G11, 238350) — caída real, en curso

Dejó de reportar el **24 de junio de 2026** y sigue sin datos a la fecha de
este documento (30/07/2026), incluyendo julio completo.

Confirmado llamando `/v2/historic` acotado a esa ventana: la API devuelve el
mismo corte exacto el 24 de junio — 5 días con dato entre el 20/jun y el
24/jun, cero después. Es una caída real de estación (probablemente de
hardware/conectividad), no un tema de sincronización nuestra.

### 5.3 Juan Hernández Díaz (G14, 241484) — bug de sincronización nuestro, YA CORREGIDO

Este es el caso opuesto a los dos anteriores: la estación **nunca tuvo cero
datos en la API** — el problema era 100% nuestro.

- La tabla raw de lecturas tenía **cero filas para esta estación desde
  siempre**.
- Al llamar `/v2/historic` directo, la API sí devolvió datos reales
  (confirmado con 22 registros de julio con lluvia real).
- **Causa raíz:** la estación nunca se insertó en la tabla de tracking de
  sincronización (`sync_status`). El proceso que recorre "qué estaciones
  sincronizar cada hora" itera sobre esa tabla — si una estación no está ahí,
  jamás entra al loop, sin importar que la API sí tenga su historial
  completo. No hay ningún error ni alerta que avise de esto: la estación
  simplemente queda invisible.
- **Corrección aplicada (27/07/2026):** se insertó la estación en la tabla de
  tracking y se disparó el backfill histórico manualmente (llamando la
  función de sincronización repetidas veces hasta ponerse al día — la API
  limita el backfill a ventanas de ~30 días por llamada). Resultado: 1999
  registros recuperados, estación puesta al día y ahora sincronizándose sola
  cada hora como el resto.

**Además**, G14 es la única estación con estructura de sensores **híbrida**:
en una sola respuesta de la API trae simultáneamente el sensor viejo (72), el
sensor nuevo NO aparece pero sí un sensor de **lluvia dedicado adicional**
(`sensor_type 298`, duplicado dos veces en la misma respuesta), más un sensor
de humedad de suelo (`211`, sin relación con clima) y dos sensores de
telemetría distintos (`501`, `505`). Ver sección 7 para el detalle de cómo
esto afecta la lectura del dato.

### 5.4 Henry Jose Cordones Linarez (P20) — no es un incidente, es config pendiente

Documentado en la sección 3. El código `P20` nunca existió como estación real
en la API de WeatherLink. No hay nada que sincronizar hasta que se asigne una
estación real a este agricultor.

### 5.5 Pedro Vicente Gomez Arvelaez (G09, 238308) — hallazgo nuevo, sin diagnosticar

Detectado en la verificación en vivo de la sección 4: cero lecturas en las
últimas 24h. Todavía no se le hizo el mismo diagnóstico contra `/v2/historic`
con ventana amplia que se le hizo a Milko y G11 — es el siguiente paso
pendiente si este documento se retoma.

---

## 6. La API de WeatherLink — referencia técnica

- Base: `https://api.weatherlink.com/v2`
- Autenticación: `api-key` como query param + header `X-Api-Secret`.
- Histórico: `GET /v2/historic/{station_id}?api-key=...&start-timestamp=...&end-timestamp=...`
  (timestamps epoch Unix, en segundos).
- Listado de estaciones activas de la cuenta (fuente de verdad de qué
  `station_id` existen de verdad): `GET /v2/stations?api-key=...`

### Rate limiting — esperen 429

La API devuelve `429 Too Many Requests` con relativa frecuencia si se piden
muchos días seguidos sin pausas. Manejo que funcionó en producción:

- Respetar el header `Retry-After` si viene.
- Si no viene: backoff exponencial `5000ms * 2^intento`, techo de 90s.
- Máximo ~6 reintentos antes de dar el request por fallido.
- Entre día y día de un backfill largo, meter una pausa pequeña de todas
  formas (300ms por día, 1s cada 5 días) — ayuda a no gatillar el 429 en
  primer lugar.

---

## 7. El problema de las generaciones de sensores (variables)

Este es el problema técnico más importante de todo el documento — no es un
bug puntual, es una característica de cómo WeatherLink estructura la
respuesta, y va a seguir apareciendo con cualquier estación nueva que se
agregue.

`/v2/historic/{station_id}` devuelve un array `sensors[]`. Cada objeto tiene
un `sensor_type`, un `data_structure_type`, y su propio array `data[]` — **y
el set de nombres de campo cambia según la generación de hardware**. No es
un solo "sensor de clima" por estación: puede haber hasta 8 objetos distintos
en una sola respuesta, y no todos son data climática.

| sensor_type | data_structure | Qué es | Trae lluvia | Generación |
|---|---|---|---|---|
| 72 | 7 | Estación combinada (clima completo) | Sí | Vieja |
| 3 | 9 | Barómetro solo | No | Vieja |
| 507 / 505 | 14 | Telemetría del dispositivo (batería, señal, uptime) | No | Vieja |
| 53 | 11 | Estación combinada (clima completo) | Sí | Nueva |
| 242 | 13 | Barómetro solo | No | Nueva |
| 504 | 15 | Telemetría del dispositivo (batería, wifi, firmware) | No | Nueva |
| 298 | 9 | Sensor de lluvia dedicado (visto en estaciones híbridas, ADEMÁS del combinado) | Sí | — |
| 211 | 9 | Sonda de humedad/temperatura de **suelo** | No — no es clima | — |

### Ejemplo real — sensor viejo (72), estación P01/Milko

```json
{
  "sensor_type": 72, "data_structure": 7,
  "sample": {
    "ts": 1785360600, "temp_out": 81.7, "hum_out": 84,
    "rainfall_in": 0, "rainfall_mm": 0,
    "wind_speed_avg": 2, "bar": 29.836
  }
}
```

### Ejemplo real — sensor nuevo (53), estación B01/Julio

```json
{
  "sensor_type": 53, "data_structure": 11,
  "sample": {
    "ts": 1785360600, "temp_last": 81.7, "temp_avg": 80.2, "hum_last": 84,
    "rainfall_in": 0, "rainfall_mm": 0, "rain_size": 0.01
  }
}
```

**El detalle que importa:** `temp_out` → `temp_last`/`temp_avg`, `hum_out` →
`hum_last` — la temperatura y la humedad SÍ cambian de nombre entre
generaciones. **La lluvia no** — `rainfall_in`/`rainfall_mm` se llama igual
en ambas generaciones y también en el sensor dedicado (298). Esto no está
garantizado por documentación de Davis/WeatherLink en ningún lado que
encontráramos — es una observación empírica sobre las estaciones de esta
cuenta, no la den por sentada sin volver a verificarla si aparece hardware
que no hemos visto todavía.

### Cómo se resuelve: leer por prioridad de nombres, no por nombre fijo

```ts
function pick(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (v !== null && v !== undefined) return v as number;
  }
  return undefined;
}

const temp    = pick(raw, "temp_out", "temp_avg", "temp_last");
const hum     = pick(raw, "hum_out", "hum_last");
const lluvia  = pick(raw, "rainfall_mm"); // hoy un solo nombre alcanza, pero
                                           // déjenlo como pick() de una vez
```

**Bug real que esto causó antes de arreglarse:** la primera versión del
código solo leía la convención vieja (`temp_out`, `hum_out`). Todas las
estaciones de generación nueva devolvían esos campos en `null` — no porque
WeatherLink no mandara el dato (sí lo mandaba, bajo `temp_last`/`hum_last`),
sino porque el código nunca miraba ese nombre. No tiró ningún error: la
columna de temperatura simplemente quedó vacía fila por fila, durante
semanas, hasta que se detectó por inspección manual. **Diagnóstico rápido
para el futuro:** si un campo climático viene sistemáticamente null solo en
ciertas estaciones (no todas), sospechen de esto antes que de un problema de
sincronización o de estación caída.

---

## 8. Deduplicación por timestamp

Cuando una estación manda, para el mismo `ts`, varios sensores a la vez (caso
típico: combinado + barómetro + telemetría; caso G14: hasta dos sensores de
lluvia distintos para el mismo timestamp), hay que mergear todo en una sola
fila por timestamp. La regla usada acá: **gana el primer valor no-null que
aparezca**, por campo.

**Limitación conocida, no resuelta:** esto no reconcilia discrepancias. Si
dos sensores de lluvia (72 y 298, como en G14) reportan cantidades distintas
para el mismo minuto, el segundo se descarta en silencio — no hay alerta, no
hay promedio, no hay lógica de "cuál es más confiable". Si la precisión al
milímetro importa, vale la pena revisar esto antes de escalar el número de
estaciones híbridas.

---

## 9. Metodología de sincronización

Dos mecanismos, para dos necesidades distintas:

### 9.1 Sincronización incremental (mantener al día lo que ya se sincronizó)

- Cron por hora recorre las estaciones registradas y, para cada una que no se
  haya sincronizado en los últimos 10 minutos, pide desde su cursor (`last_ts`
  guardado) hasta ahora, en ventanas de máximo ~30 días por llamada.
- **Si la ventana vuelve vacía** (hueco real de la estación en WeatherLink),
  **el cursor avanza igual hasta el final de la ventana**. Bug real que esto
  arregla: sin este fix, una estación con un hueco de datos pedía
  eternamente la misma ventana vacía y quedaba pegada en estado "syncing"
  para siempre — el cursor nunca avanzaba porque solo subía al `ts` del
  último registro real, y si no había registros reales, no subía.

### 9.2 Backfill histórico (poner al día una estación desde cero)

- Cola de jobs, uno por `(estación, año, mes)`, procesados de a uno por
  minuto con throttling — no todo en un solo request, para no gatillar rate
  limiting y para poder reintentar solo el mes que falló sin repetir todo.
- Un proceso diario re-encola meses con lecturas incompletas (detecta filas
  con temperatura null como señal de que el sync quedó a medias) — **pero
  solo para estaciones que ya existen en la cola**. Ver sección 10.

---

## 10. Gap arquitectónico: sin auto-discovery de estaciones

Ninguno de los dos mecanismos de la sección 9 agrega estaciones nuevas por su
cuenta. Si una estación existe en la API de WeatherLink pero nunca se
registró manualmente en las tablas de tracking de sincronización, **queda
invisible para todo el pipeline indefinidamente** — sin error, sin alerta,
simplemente nunca se sincroniza, aunque la API sí tenga su data completa.

Esto es exactamente lo que le pasó a G14 (caso 5.3): meses sin sincronizar,
descubierto solo porque alguien preguntó por qué salía la alerta de "pocos
días con dato" en el dashboard. **Si se reconstruye este pipeline: el primer
paso al agregar una estación nueva tiene que ser explícito y verificable** —
no asumir que "está en la API" es suficiente para que el sistema la recoja
sola.

---

## 11. Checklist antes de tocar este pipeline

Destilado de las secciones anteriores. Si vas a modificar el pipeline de clima
o a reconstruirlo en otro proyecto, revisa esta lista primero.

### Al diagnosticar un hueco de datos

1. **Pregunta primero a la API, no a nuestra base.** Llama
   `/v2/historic/{station_id}` para la ventana en duda. Los tres diagnósticos
   posibles son distintos y se arreglan en lugares distintos:
   - La API tampoco tiene el dato → **falla de estación física**. Avisar al
     equipo de campo; no hay nada que arreglar en el código (§5.1, §5.2).
   - La API sí tiene el dato → **bug nuestro**. Empezar por si la estación
     existe en `sync_status` (§5.3).
   - El `station_id` no existe en `/v2/stations` → **config pendiente**, no
     incidente (§5.4).
2. **No confundir "0 mm" con "sin dato".** Antes de usar la lluvia de un mes en
   cualquier cálculo, filtrar por cantidad mínima de días con lectura (§5.1).

### Al agregar una estación

3. **Insertarla explícitamente en `sync_status`.** No hay auto-discovery: una
   estación que está en la API pero no en la tabla de tracking queda invisible
   para siempre, sin error ni alerta (§10).
4. **Verificar que llegan lecturas** antes de dar el alta por buena, y disparar
   el backfill histórico a mano si hace falta ponerla al día (§5.3).
5. **No asumir la generación de hardware por la fecha de instalación.** Hay
   estaciones instaladas en 2026 con sensores de la generación vieja (§4).

### Al escribir código que lea la API

6. **Leer los campos por prioridad de nombres, nunca por nombre fijo**
   (`pick(raw, "temp_out", "temp_avg", "temp_last")`). Un nombre fijo no falla:
   deja la columna en null en silencio (§7).
7. **Recorrer `sensors[]` completo y filtrar por `sensor_type`.** No todos son
   clima: hay barómetro, telemetría y humedad de suelo mezclados (§7).
8. **Mergear por `ts`** con la regla "gana el primer valor no-null". Ojo con las
   estaciones híbridas, que traen dos sensores de lluvia para el mismo minuto
   (§8).
9. **Implementar el manejo de `429` desde el principio**: `Retry-After`, backoff
   exponencial con techo, pausas entre días del backfill (§6).
10. **Avanzar el cursor aunque la ventana venga vacía**, o una estación con un
    hueco queda pegada en "syncing" para siempre (§9.1).

### Al calcular sobre las lecturas

11. **Nunca agregar en vivo sobre la tabla raw** desde el frontend: supera el
    millón de filas y causa timeouts. Consumir los agregados refrescados por
    cron (§2).
12. En este repo, además: **nunca `DISTINCT ON` contra `weather_readings`** para
    la última lectura — usar `cross join lateral (… order by ts desc limit 1)`.
    Ver [AGENTS.md](../AGENTS.md#rendimiento).
