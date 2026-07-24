---
title: "Programa Saturno"
subtitle: "Plataforma digital del Programa de Agricultura por Contrato"
author: "Equipo de Agricultura Polar"
date: "18 de abril de 2026"
---

# Programa Saturno

## Plataforma digital del Programa de Agricultura por Contrato
### Maíz blanco · Anexo de presentación a la junta

**18 de abril de 2026**

Entorno productivo: agri-platform-omega.vercel.app

---

## Resumen ejecutivo

- Plataforma única que centraliza el Programa de Agricultura por Contrato
- Convierte data dispersa (Davis, lotes, ENSO, GFS) en decisiones agronómicas
- Sirve simultáneamente a la gerencia técnica (rol master) y al productor (rol farmer)
- Cinco de seis fases en producción
- Estado: prototipo funcional desplegado, no aún MVP formal
- Brechas concretas identificadas para alcanzar MVP en ~1 semana de trabajo

---

## El problema que resuelve

| Antes | Hoy con la plataforma |
|---|---|
| Información dispersa en hojas de cálculo | Vista única en tiempo real |
| Calendarios fijos sin ajustar al clima local | Predictor IA con ventana óptima de siembra |
| Gestión reactiva del riesgo climático | Alertas predictivas a 7 días |
| Asistencia técnica solo presencial | Asistente IA agronómico 24/7 |
| Reportería manual ad-hoc | Exportación PDF/Excel automática |

---

## Jobs To Be Done — marco conceptual

- Los usuarios no compran productos: **contratan soluciones para hacer un trabajo**
- Identificamos jobs en tres dimensiones por usuario:
  - **Funcional**: qué necesitan lograr
  - **Emocional**: cómo necesitan sentirse
  - **Social**: cómo necesitan ser percibidos
- Algunos jobs ya están validados por uso; otros son hipótesis pendientes de confirmar en piloto

---

## Jobs del agricultor

| Dimensión | Job principal |
|---|---|
| Funcional | "Decide cuándo sembrar para maximizar mi rendimiento" |
| Funcional | "Avísame cuando viene mal tiempo para proteger mi cultivo" |
| Funcional | "Dame respuesta agronómica rápida sin esperar visita técnica" |
| Funcional | "Dame evidencia de mi producción para mostrar contrato en regla" |
| Emocional | "Hazme sentir que no estoy solo enfrentando el riesgo climático" |
| Emocional | "Reduce mi ansiedad sobre si tomo decisiones correctas" |
| Social | "Ayúdame a verme profesional ante el equipo agronómico de Polar" |

---

## Jobs de Polar (gerencia técnica)

| Dimensión | Job principal |
|---|---|
| Funcional | "Dame visibilidad en tiempo real de toda mi operación" |
| Funcional | "Anticipa volúmenes de cosecha para planificar Harina P.A.N." |
| Funcional | "Reduce el costo unitario de asistencia técnica al productor" |
| Funcional | "Estandariza recomendaciones agronómicas a través de los 20 agricultores" |
| Funcional | "Provee trazabilidad auditable para reportes de cumplimiento" |
| Emocional | "Demuestra a la dirección que el programa es innovador" |
| Social | "Posiciona a Polar como líder en digitalización agrícola en Venezuela" |

---

## La operación hoy en cifras

| Indicador | Valor |
|---|---|
| Agropecuarias integradas | **20** |
| Lotes monitoreados | **161** |
| Estaciones meteorológicas Davis | **16** |
| Frecuencia de actualización climática | **15 minutos** |
| Cobertura del pronóstico | **7 días** |
| Disponibilidad del asistente IA | **24/7** |

---

## Valor agregado — para Polar (rol master)

- **Visibilidad consolidada** de los 20 agricultores y 161 lotes en una sola vista
- **Decisión agronómica asistida por IA** con ventana óptima de siembra
- **Anticipación de riesgo climático** mediante alertas a 7 días
- **Asistencia técnica escalable** sin incremento lineal de costo
- **Reportería instantánea** en PDF y Excel
- **Trazabilidad de cosecha** por lote, hectárea y rendimiento

---

## Valor agregado — para el agricultor (rol farmer)

- **Diagnóstico instantáneo** de su finca (clima en vivo + pronóstico)
- **Recomendación personalizada** de fecha de siembra con score 0–100
- **Alertas tempranas** de eventos climáticos extremos
- **Línea de tiempo visual** del ciclo del maíz (6 fases)
- **Asistente IA disponible 24/7** con contexto específico de su finca
- **Reportes descargables** de su producción

---

## Impacto estratégico

- **Reducción del riesgo de cosecha** por anticipación de eventos climáticos
- **Optimización del rendimiento por hectárea** vía mejor timing de siembra
- **Escalabilidad** del programa sin crecimiento proporcional de equipo agronómico
- **Mejor planificación de compra** por visibilidad anticipada de volúmenes
- **Profesionalización digital** equiparable a estándares internacionales

---

## Módulos en producción

| Módulo | Estado | Master | Farmer |
|---|---|---|---|
| Login y autenticación | Operativo | Sí | Sí |
| Dashboard ejecutivo | Operativo | Sí | Sí |
| Cultivo (timeline + predictor IA) | Operativo | Sí | Sí |
| Clima (lecturas + pronóstico + alertas) | Operativo | Sí | Sí |
| Finanzas | Operativo | Sí | Sí |
| Suelo | Operativo | Sí | Sí |
| Selector multi-tenant | Operativo | Sí | N/A |
| Chat IA agronómico | Listo, pendiente activación clave | Sí | Sí |
| Reportes PDF/Excel | Operativo | Sí | Sí |
| Envío de reportes por correo | Pendiente Fase E | — | — |

---

## Módulo Cultivo

- Línea de tiempo visual de las 6 fases del maíz por lote
- Stat cards: días desde siembra, riego, sparkline climático, descripción de fase
- **Predictor IA de siembra** (Anthropic Claude):
  - Fecha óptima ("D-day") con score 0–100
  - 3 fechas alternativas comparativas
  - Reasoning agronómico detallado
  - Contexto climático (temperatura, lluvia, humedad)
- Botones de reporte PDF y Excel por lote

---

## Módulo Clima

- Lecturas Davis en tiempo real (temperatura, humedad, lluvia, radiación)
- **Pronóstico de 7 días** en strip horizontal con iconografía dinámica
- **Sistema de alertas agronómicas** codificado por severidad:
  - Lluvia fuerte (≥30 mm/día)
  - Calor extremo (≥38°C)
  - Frío inusual / helada (≤12°C / ≤8°C)
  - Viento fuerte (≥40 km/h)
  - Lluvia probable (≥70%)
- Detección y marca visual de datos antiguos

---

## Asistente conversacional IA

- Botón flotante en cada página autenticada
- Construye contexto en vivo: lotes + última lectura + pronóstico 7d
- Powered by **Google Gemini 1.5 Flash**
- Especializado en maíz blanco venezolano
- 4 preguntas sugeridas iniciales para arrancar
- Respuestas en español, máximo 3 párrafos
- Manejo robusto de errores (clave inválida, cuota agotada)

---

## Selector multi-tenant

- Disponible solo para rol master
- Persiste selección en query string (`?agricultor=KEY`)
- URLs compartibles entre miembros del equipo agronómico
- Contexto se mantiene al navegar entre módulos
- Farmer queda automáticamente fijado a su agropecuaria
- Aislamiento de datos garantizado por Row Level Security

---

## Arquitectura tecnológica

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 + React + TypeScript |
| Estilos | Tailwind CSS v4 |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| Hosting | Vercel (CD desde GitHub) |
| IA conversacional | Google Gemini 1.5 Flash |
| IA de razonamiento | Anthropic Claude |
| Datos meteorológicos | WeatherLink (Davis) |
| Pronóstico extendido | Modelo GFS |
| Seguridad | Row Level Security + JWT |

---

## Metodología — fases incrementales

| Fase | Alcance | Estado |
|---|---|---|
| A | Selector master en Cultivo | Desplegado |
| B | Selector replicado a 4 módulos | Desplegado |
| C | Pronóstico 7d + alertas | Desplegado |
| D | Predictor IA de siembra | Desplegado |
| E | Reportes por correo | Pendiente |
| F | Asistente IA conversacional | Desplegado |

Cada fase: diseño → desarrollo → build → commit → deploy automático → verificación

---

## Buenas prácticas aplicadas

- **Multi-tenant seguro por defecto** (Row Level Security en cada tabla)
- **Server Components first** para SEO y performance
- **Composición de componentes** reutilizables entre módulos
- **Fall-backs explícitos** ante datos faltantes (sin fallos silenciosos)
- **Reuso de infraestructura** (sin introducir nuevos proveedores innecesarios)
- **Despliegue continuo** desde GitHub a Vercel

---

## Camino al MVP — definición operativa

**Definimos MVP como:**

> La versión mínima del producto que un agricultor real puede usar productivamente durante un ciclo completo de cultivo (siembra → cosecha) sin asistencia del equipo de desarrollo, y que el equipo agronómico de Polar puede operar para todos los 20 agricultores sin generar fricción operativa.

**Hoy estamos en estado de prototipo funcional desplegado, no en MVP.**

Cinco fases en producción y operación armada, pero quedan brechas concretas para piloto real con los 20 agricultores.

---

## Brechas para MVP — Datos y operación

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Cron WeatherLink | ~50% de llamadas devuelven HTTP 400 | ≥95% de éxito |
| Frescura lecturas Davis | Última: agosto 2025 | Latencia ≤30 min |
| Frescura pronóstico GFS | Último: 4-abril-2026 | Cron diario activo |
| Mapeo estaciones↔agricultores | 16 de 20 mapeados; 1 piloto con workaround | Mapeo real 1:1 verificado |
| Cobertura predictor de siembra | Solo agricultores con estación | Definir UX sin estación local |

---

## Brechas para MVP — Onboarding y UX

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Usuarios registrados | 2 perfiles | 1 master + 20 farmer activos |
| Alta de agricultor | Manual desde panel Supabase | Procedimiento ejecutable por no-técnico |
| Recuperación de contraseña | No probada | Flujo funcional vía email |
| MFA para master | No implementado | Obligatorio |
| Versión móvil | Responsive sin pruebas exhaustivas | Validada en pantallas 360px |
| Documentación usuario | Inexistente | Guía 2-3 páginas por rol |
| Soporte L1 | Indefinido | Quién, plazo, canal |

---

## Esfuerzo estimado para MVP

| Bloque | Esfuerzo |
|---|---|
| Resolver crons y frescura de datos | 4–8 horas |
| Onboarding sistemático de 20 agricultores | 8–12 horas |
| Validación móvil + correcciones | 8–16 horas |
| Activar Gemini + Fase E (correos) | 2–3 horas |
| Documentación de usuario y soporte L1 | 4–8 horas |
| **Total** | **26–47 horas (~1 semana de trabajo enfocado)** |

---

## Cruxes — qué son

Un **crux** es la pregunta o problema central cuya respuesta determina si el proyecto tiene éxito o fracasa.

A diferencia de un riesgo (que **puede** o **no** materializarse), un crux es un **nudo que necesariamente debemos atravesar** para consolidar el producto.

Identificamos **8 cruxes** que el proyecto está atravesando:

- 4 técnicos / de infraestructura
- 2 organizacionales / de comportamiento
- 2 económicos y de gobernanza

---

## Cruxes técnicos y de infraestructura

| # | Crux | Por qué es crítico |
|---|---|---|
| 1 | Calidad y frescura de datos meteorológicos | Sin datos confiables, todo el producto pierde valor de decisión |
| 4 | Conectividad rural en zonas de agricultores | Si falla justo cuando más se necesita, utilidad percibida = 0 |
| 5 | Concentración de privilegios en rol master | Una credencial comprometida = brecha de los 20 agricultores |
| 8 | Gobernanza y mantenimiento post-launch | Sin dueño operacional, plataforma se degrada en 6-12 meses |

---

## Cruxes organizacionales y económicos

| # | Crux | Por qué es crítico |
|---|---|---|
| 2 | Adopción real por parte de agricultores | Producto sin uso = no hay producto |
| 3 | Confianza organizacional en recomendaciones IA | Si IA y agrónomo discrepan, ¿quién prevalece? |
| 6 | Costo unitario al escalar (Gemini, Claude, Davis, Vercel) | Crecer a 50-100 agricultores puede romper el ROI |
| 7 | Coexistencia con sistemas existentes de Polar (SAP) | "Sistema sombra" sin sync con ERP genera discrepancias |

---

## Hipótesis de mitigación de cruxes (resumen)

- **Datos**: auditar cron, monitoreo proactivo, SLA interno de frescura
- **Adopción**: piloto controlado de 3-5 agricultores antes del rollout
- **Confianza IA**: protocolo IA-como-asistente, validación humana de recomendaciones críticas
- **Conectividad**: PWA con caché offline, alertas por SMS/WhatsApp
- **Privilegios**: MFA obligatorio, segregación master agronómico vs administrativo
- **Costos**: modelado por agricultor activo/mes, caching, modelos económicos
- **ERP**: mapeo flujos con IT corporativo, definir source of truth
- **Gobernanza**: SLA de soporte, presupuesto operativo, transferencia de conocimiento

---

## Lo que falta — acciones inmediatas

### Acción inmediata (5 minutos)
- Activar `GEMINI_API_KEY` en Supabase → Settings → Edge Functions → Secrets
- Sin esta clave el chat no responde; con ella queda 100% operativo

### Fase E — reportes por correo (~2 horas)
- Envío automático semanal de reporte PDF al email de cada agropecuaria
- Botón "enviar por correo" desde la app
- Plantilla HTML corporativa Polar
- Logging de envíos
- Requiere alta de cuenta en Resend (capa gratuita: 3 000 emails/mes)

---

## Roadmap de mejoras post-MVP

| Mejora | Valor | Esfuerzo |
|---|---|---|
| Notificaciones push/SMS para alertas críticas | Comunicación proactiva sin login | Medio |
| Mapa interactivo con vista satelital | Vista geoespacial de la operación | Medio-alto |
| Comparativos año contra año | Análisis de tendencias | Bajo-medio |
| Dashboard analítico por estado/región | Decisiones a nivel de programa | Medio |
| Onboarding autoservicio de agricultores | Escalar el programa sin fricción | Medio |
| App móvil nativa iOS/Android | Acceso de campo offline | Alto |

---

## Riesgos operativos vs cruxes

| Riesgo operativo (mitigado en código) | Mitigación |
|---|---|
| Datos meteorológicos atrasados | Fall-back automático con marca visual |
| Falla de Gemini API | Mensajes contextuales, no bloquea operativa |
| Acceso indebido entre agricultores | Row Level Security por `agricultor_key` |
| Caída del cron WeatherLink | Logs en Supabase, sincronización cada 15 min |
| Rotación de API keys | Centralizadas en Supabase Secrets |
| Pérdida de sesión | JWT con renovación automática |

Los **cruxes** (slides anteriores) son problemas estructurales no mitigables por código solo: requieren decisión organizacional.

---

## Conclusiones

1. La plataforma cumple los objetivos planteados al inicio del proyecto
2. **Cinco de seis fases en producción**, validadas con datos reales
3. Estado actual: **prototipo funcional desplegado** (no aún MVP formal)
4. Camino al MVP estimado en **~1 semana** de trabajo enfocado (26-47 horas)
5. **8 cruxes identificados** — los técnicos se cierran con código; los organizacionales requieren dueño en Polar
6. El stack tecnológico está preparado para escalar a más agricultores sin retrabajo

---

## Recomendación a la junta

1. **Aprobar el cierre de brechas para MVP** (~1 semana)
2. **Autorizar la activación** de la API key de Gemini para habilitar el asistente
3. **Designar dueños organizacionales** para los cruxes 3, 7 y 8 (confianza en IA, integración SAP, gobernanza post-launch)
4. **Aprobar piloto controlado** con 3-5 agricultores para validar adopción antes del rollout completo de 20
5. **Iniciar planificación** del roadmap post-MVP:
   - Notificaciones SMS
   - Mapa satelital
   - Comparativos año contra año

---

## Contacto y referencias

- **Repositorio del producto:** github.com/perez-luis-netizen/agri-platform
- **Entorno productivo:** agri-platform-omega.vercel.app
- **Documento ejecutivo completo:** INFORME_EJECUTIVO.md
- **Soporte técnico:** equipo de plataforma digital Polar

---

## Gracias

### Programa Saturno
**Inteligencia agronómica para el Programa de Agricultura por Contrato**
