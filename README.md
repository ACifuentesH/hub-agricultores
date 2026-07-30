# Programa Saturno

Plataforma digital del Programa de Agricultura por Contrato (maíz blanco).
Reúne clima, cultivo y documentación de cada agricultor en una sola interfaz,
para el equipo técnico y para los propios productores.

**Producción:** https://agri-platform-omega.vercel.app

> El repositorio se llama `agri-platform` por razones históricas; el producto es
> **Programa Saturno**. "Polar" a secas se refiere a la empresa.

---

## Arranque

```bash
npm install
npm run dev
```

Requiere un `.env.local` con las credenciales de Supabase y WeatherLink
(ver `.env.example`). **Nunca se commitea.**

```bash
npm run build   # usa --webpack a propósito: Turbopack rompe con Serwist
npm run lint
```

Push a `main` despliega automáticamente en Vercel.

---

## Módulos

| Ruta | Qué hace |
|---|---|
| `/dashboard` | KPIs del ciclo, tabla de lotes y centro de novedades |
| `/clima` | Lectura actual, pronóstico a 7 días, alertas e histórico |
| `/cultivo` | Línea de tiempo por lote, etapa fenológica, suelo e insumos |
| `/documentacion` | Análisis de suelo, mapas, caso de negocio y convenios |
| `/master` | Consola de validación: qué ve cada usuario, con acceso directo |

Dos roles: **farmer** (ve solo lo suyo, por RLS) y **master** (valida la vista
de cualquier agricultor mediante `?agricultor=`).

Todas las pantallas trabajan sobre el **ciclo activo**. El selector 2025/2026 se
retiró el 30-jul-2026: el ciclo 2025 está cerrado y verlo mezclado con el ciclo
en curso confundía más de lo que aportaba.

Para entender cómo está armado por dentro:
[**Arquitectura**](docs/ARQUITECTURA.md) · [**Componentes**](docs/COMPONENTES.md)

---

## De dónde salen los datos

```
Saturno (sistema origen)  ──4 volcados/día──►  esquema `saturno.*`  ──►  app
WeatherLink (44 estaciones) ──cron horario──►  weather_readings     ──►  app
```

- **Datos operativos** (lotes, agricultores, insumos, cosecha): los produce
  **Saturno**; la app los espeja y no los edita.
  → [`docs/SINCRONIZACION_SATURNO.md`](docs/SINCRONIZACION_SATURNO.md)
- **Clima**: único dato que la app captura por sí misma, desde estaciones Davis.
  Quien no tiene estación propia ve el módulo vacío — la triangulación entre
  estaciones cercanas se retiró el 30-jul-2026 porque una estimación a decenas de
  kilómetros se leía en pantalla igual que una medición del lote.
  → [`docs/OPERACION_PIPELINE_CLIMA.md`](docs/OPERACION_PIPELINE_CLIMA.md)

Para revisar el estado de la sincronización:

```sql
select * from public.v_saturno_salud;
```

---

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · HeroUI v3 (piloto) ·
Supabase (Postgres + Auth + Storage + Edge Functions) · PWA con Serwist ·
Recharts · desplegado en Vercel.

---

## Antes de tocar el código

Lee **[`AGENTS.md`](AGENTS.md)**. Recoge las decisiones y trampas que ya
costaron caro: el formato de fecha de Saturno, por qué las escrituras pasan por
`service_role`, por qué el middleware no debe interceptar el service worker, y
qué patrón de consulta hunde el rendimiento del clima.
