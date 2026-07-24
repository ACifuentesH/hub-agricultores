# INFORME EJECUTIVO
## Plataforma Digital "Proyecto Saturno"
### Estado del proyecto, valor de negocio, camino al MVP y cruxes a resolver

| | |
|---|---|
| **Producto** | Proyecto Saturno — Agri-Platform |
| **Fecha del informe** | 18 de abril de 2026 |
| **Entorno productivo** | https://agri-platform-omega.vercel.app |
| **Estado global** | Prototipo funcional desplegado en producción |
| **Cobertura actual** | 20 agropecuarias · 161 lotes · 16 estaciones Davis |
| **Usuarios activos** | 2 perfiles (1 master corporativo, 1 agricultor piloto) |

---

## 1. RESUMEN EJECUTIVO

**Proyecto Saturno** es la plataforma digital que centraliza la operación del Programa de Agricultura por Contrato (maíz blanco) en una sola interfaz operativa. Convierte la data dispersa —estaciones meteorológicas Davis, registros productivos de lotes, percentiles climáticos históricos y pronósticos GFS— en decisiones agronómicas accionables, tanto para la gerencia técnica de Polar como para cada agricultor del programa.

La plataforma se encuentra **operativa en producción** con cinco módulos funcionales (Dashboard, Cultivo, Clima, Finanzas y Suelo), un selector multi-tenant para vista corporativa, un predictor de fecha de siembra basado en IA, un sistema de alertas climáticas y un asistente conversacional agronómico. El proyecto se ejecutó en seis fases incrementales (A–F), de las cuales **cinco están desplegadas**.

El estado actual es de **prototipo funcional desplegado**: cinco fases en producción y la operación está armada, pero existen brechas concretas que separan al producto de un MVP listo para piloto formal con los 20 agricultores. Este informe detalla qué jobs estamos satisfaciendo, qué módulos están operativos, qué falta cerrar para alcanzar el MVP y cuáles son los cruxes —puntos críticos no resueltos— que el proyecto debe atravesar para consolidarse.

---

## 2. JOBS TO BE DONE — QUÉ PROBLEMA CREEMOS RESOLVER

### 2.1 Marco conceptual

El framework Jobs To Be Done (JTBD) sostiene que los usuarios no compran productos: contratan soluciones para hacer un trabajo en su vida o negocio. Identificamos los jobs en tres dimensiones por usuario: **funcional** (qué necesitan lograr), **emocional** (cómo necesitan sentirse) y **social** (cómo necesitan ser percibidos).

Esta sección establece nuestra hipótesis sobre los jobs que la plataforma satisface. Algunos jobs ya están validados por uso; otros son hipótesis pendientes de confirmar con usuarios reales en el piloto.

### 2.2 Jobs del agricultor (productor de maíz blanco)

| Dimensión | Job To Be Done |
|---|---|
| Funcional | "Ayúdame a decidir cuándo sembrar para maximizar mi rendimiento" |
| Funcional | "Avísame cuando viene mal tiempo para que pueda proteger mi cultivo" |
| Funcional | "Dame una respuesta agronómica rápida cuando tengo una duda, sin esperar a una visita técnica" |
| Funcional | "Muéstrame cómo está mi finca ahora mismo" |
| Funcional | "Dame evidencia de mi producción para mostrar que mi contrato va en regla" |
| Emocional | "Hazme sentir que no estoy solo enfrentando el riesgo climático" |
| Emocional | "Reduce mi ansiedad sobre si estoy tomando las decisiones correctas" |
| Emocional | "Hazme sentir competente y moderno como productor" |
| Social | "Ayúdame a verme profesional ante el equipo agronómico de Polar" |
| Social | "Dame argumentos técnicos cuando negocio condiciones del programa" |

### 2.3 Jobs de Polar (gerencia técnica del programa)

| Dimensión | Job To Be Done |
|---|---|
| Funcional | "Dame visibilidad en tiempo real de toda mi operación de agricultura por contrato" |
| Funcional | "Ayúdame a anticipar volúmenes de cosecha para planificar producción industrial de Harina P.A.N." |
| Funcional | "Reduce el costo unitario de proveer asistencia técnica al productor" |
| Funcional | "Detecta eventos climáticos de riesgo antes de que impacten la cadena de suministro" |
| Funcional | "Estandariza recomendaciones agronómicas a través de los 20 agricultores" |
| Funcional | "Provee trazabilidad auditable para reportes de cumplimiento y sostenibilidad" |
| Emocional | "Hazme sentir en control de una operación agrícola distribuida" |
| Emocional | "Demuestra a la dirección que el programa es innovador y está bien administrado" |
| Social | "Posiciona a Polar como líder de digitalización agrícola en Venezuela" |
| Social | "Fortalece la relación con los productores ofreciéndoles herramientas modernas" |
| Social | "Justifica la inversión del programa ante stakeholders corporativos" |

### 2.4 Mapeo módulo → job principal que atiende

| Módulo | Job principal que atiende |
|---|---|
| Predictor de siembra (Cultivo) | "Decide cuándo sembrar para maximizar rendimiento" + "Estandariza recomendaciones agronómicas" |
| Pronóstico 7d + alertas (Clima) | "Avísame cuando viene mal tiempo" + "Detecta eventos climáticos de riesgo" |
| Asistente IA conversacional | "Dame respuesta agronómica rápida sin esperar visita" + "Reduce costo unitario de asistencia técnica" |
| Línea de tiempo de Cultivo | "Muéstrame cómo está mi finca" + "Dame visibilidad en tiempo real" |
| Reportes PDF/Excel | "Dame evidencia de mi producción" + "Provee trazabilidad auditable" |
| Selector multi-tenant master | "Dame visibilidad de toda mi operación" |

### 2.5 Hipótesis pendientes de validar

Estos son trabajos que asumimos satisfacer pero que requieren validación con usuarios reales en piloto:

- Que los agricultores efectivamente confíen en una recomendación de siembra generada por IA por encima de su intuición y costumbre
- Que el equipo agronómico de Polar adopte el sistema en lugar de mantener procesos paralelos en hojas de cálculo
- Que los productores tengan conectividad e inclinación digital suficiente para usar la app con frecuencia significativa
- Que la calidad del pronóstico GFS sea suficientemente local para los llanos venezolanos
- Que los reportes auto-generados sean aceptados por los procesos administrativos internos de Polar

---

## 3. VALOR AGREGADO AL PROGRAMA DE AGRICULTURA POR CONTRATO

### 3.1 Beneficios para Polar (rol "master" — gerencia técnica)

| Capacidad | Situación previa | Capacidad con la plataforma |
|-----------|------------------|------------------------------|
| Visibilidad de campo | Información dispersa en hojas de cálculo y reportes manuales por agricultor | Vista única en tiempo real de los 20 agricultores y 161 lotes |
| Decisión agronómica | Calendarios fijos sin ajuste a clima local | Predictor IA con ventana óptima de siembra basada en pronóstico de 7 días, percentiles ENSO e historial de la estación local |
| Gestión de riesgo climático | Reactiva (posterior al evento) | Alertas predictivas a 7 días: lluvia fuerte, calor extremo, helada, viento de acame |
| Asistencia técnica al productor | Visitas de campo presenciales y consultas telefónicas | Asistente IA agronómico disponible 24/7, con contexto específico de cada finca |
| Trazabilidad y reportería | Generación manual ad-hoc | Exportación PDF y Excel automática por lote |

### 3.2 Beneficios para el agricultor (rol "farmer")

| Capacidad | Detalle |
|-----------|---------|
| Diagnóstico instantáneo de la finca | Última lectura Davis (temperatura, humedad, lluvia, radiación) + sparkline de 14 días + pronóstico de 7 días |
| Decisión de siembra optimizada | Recomendación con score 0–100, ventana de fechas alternativas y reasoning detallado generado por IA |
| Alertas tempranas | Notificaciones de eventos climáticos extremos hasta una semana antes de su ocurrencia |
| Trazabilidad productiva | Hectáreas sembradas, cosechadas y perdidas; rendimiento real por unidad de producción |
| Línea de tiempo del cultivo | Vista visual de las 6 fases del ciclo del maíz, con días desde siembra y descripción agronómica de cada etapa |
| Reportes descargables | Línea de tiempo del lote en PDF y balance de lote en Excel |

### 3.3 Indicadores cuantitativos de la operación actual

| Indicador | Valor |
|-----------|-------|
| Agropecuarias integradas | 20 |
| Lotes monitoreados | 161 |
| Estaciones meteorológicas Davis sincronizadas | 16 |
| Frecuencia de actualización de datos climáticos | Cada 15 minutos (cron WeatherLink) |
| Cobertura del pronóstico | 7 días con probabilidad de lluvia, mm, temperaturas mín/máx, humedad y viento |
| Tiempo de decisión de fecha de siembra | De horas (análisis manual) a segundos (predictor IA) |
| Disponibilidad del asistente agronómico | 24/7 (al activar la clave Gemini) |

### 3.4 Impacto estratégico

- **Reducción del riesgo de cosecha:** la combinación de pronóstico + percentiles ENSO + alertas anticipa pérdidas por evento climático
- **Optimización del rendimiento por hectárea:** el predictor IA identifica la ventana de siembra que maximiza la coincidencia entre fases críticas del cultivo y condiciones favorables
- **Escalabilidad de la asistencia técnica:** un asistente IA atiende a 20 agricultores simultáneamente con contexto personalizado
- **Mejora en la planificación de compra:** la visibilidad de hectáreas sembradas, fechas y rendimientos esperados permite anticipar volúmenes de cosecha por estado y región
- **Profesionalización digital del programa:** equipara la operación de Polar a estándares de agricultura de precisión utilizados por agroindustrias internacionales

---

## 4. ESTADO DE FUNCIONALIDAD POR MÓDULO

### 4.1 Tabla resumen

| Módulo | Estado | Master | Agricultor |
|--------|--------|--------|------------|
| Login y autenticación | Producción | Sí | Sí |
| Dashboard ejecutivo | Producción | Sí | Sí |
| Cultivo (línea de tiempo + predictor IA) | Producción | Sí | Sí |
| Clima (lecturas + pronóstico 7d + alertas) | Producción | Sí | Sí |
| Finanzas | Producción | Sí | Sí |
| Suelo | Producción | Sí | Sí |
| Selector multi-tenant de agricultor | Producción | Sí | N/A |
| Asistente conversacional IA | Listo, requiere activación de clave Gemini | Sí | Sí |
| Reportes PDF de lote | Producción | Sí | Sí |
| Reportes Excel de lote | Producción | Sí | Sí |
| Envío de reportes por correo | Pendiente (Fase E) | — | — |

### 4.2 Descripción detallada de cada módulo

#### Login y autenticación
Pantalla de inicio con diseño split-screen. Autenticación vía Supabase Auth con sesión persistente. Redirección automática según rol (master o farmer). Soporte para modo claro/oscuro.

#### Dashboard ejecutivo
Vista resumen de la operación. Muestra el conteo de lotes, hectáreas sembradas, estado climático general y atajos a los módulos. Para el master, presenta el selector de agricultor; para el farmer, muestra directamente sus datos.

#### Módulo Cultivo
- Línea de tiempo visual del ciclo del maíz: 6 fases (emergencia, establecimiento, vegetativo, floración, llenado de grano, madurez) con marcador de progreso por lote
- Stat cards por lote: días desde siembra, estado de riego, sparkline de clima de los últimos 14 días, descripción agronómica de la fase actual
- Predictor de siembra (Fase D): panel on-demand que llama a la edge function `predictor-siembra` (powered by Anthropic Claude). Devuelve fecha óptima ("D-day"), score 0–100 con anillo animado, breakdown de factores, 3 fechas alternativas con scores comparativos, reasoning agronómico y contexto climático
- Botones de reporte por lote: PDF (línea de tiempo) y Excel (balance)
- Condiciones actuales mostradas en chip flotante con icono dinámico según el clima

#### Módulo Clima (Fase C)
- Lecturas en tiempo real de la estación Davis asociada al agricultor
- Pronóstico de 7 días en strip horizontal: día, icono dinámico, temperaturas mín/máx, probabilidad de lluvia y mm estimados
- Panel de alertas agronómicas con codificación por severidad:
  - Lluvia fuerte (≥30 mm/día) — peligro
  - Calor extremo (≥38°C, crítico ≥40°C) — advertencia/peligro
  - Frío inusual (≤12°C, helada ≤8°C) — advertencia/peligro
  - Viento fuerte (≥40 km/h) — riesgo de acame
  - Lluvia probable (≥70%) — informativo
- Detección de datos antiguos con fall-back automático y marca visual

#### Módulo Finanzas
Vista de información económica por agropecuaria y por lote. Filtrado por agricultor (master) o auto-filtrado por sesión (farmer).

#### Módulo Suelo
Información edafológica por lote: tipo de suelo, análisis disponibles, tratamientos. Filtrado por agricultor.

#### Selector multi-tenant (Fases A y B)
Dropdown disponible en el header de cada módulo solo para usuarios con rol master. Lista los 20 agricultores y persiste la selección en el query string. URLs compartibles entre miembros del equipo. El farmer queda automáticamente fijado a su propia agropecuaria.

#### Asistente conversacional IA (Fase F)
- Botón flotante verde en la esquina inferior derecha de cada página autenticada
- Panel deslizable con 4 preguntas sugeridas iniciales
- Llama a la edge function `agri-asistente` que construye contexto en vivo y consulta a Google Gemini 1.5 Flash
- Especializado en maíz blanco venezolano
- Estado actual: operativo a nivel de código y despliegue; **pendiente activar la API Key de Gemini en los secrets de Supabase**

---

## 5. METODOLOGÍA Y PROCESO DE DESARROLLO

El proyecto se ejecutó siguiendo un esquema de **fases incrementales (A–F)**. Cada fase fue desplegada de forma independiente a producción para validación temprana, evitando riesgo de big-bang.

### 5.1 Fases ejecutadas

| Fase | Alcance | Estado |
|------|---------|--------|
| A | Selector master multi-tenant en módulo Cultivo (validación del patrón) | Desplegado |
| B | Replicación del selector a Clima, Dashboard, Finanzas y Suelo | Desplegado |
| C | Pronóstico de 7 días + sistema de alertas agronómicas en Clima | Desplegado |
| D | Predictor de fecha de siembra (Anthropic Claude + datos Davis) | Desplegado |
| E | Reportes por correo electrónico vía Resend | Pendiente |
| F | Asistente conversacional IA (Google Gemini + contexto de finca) | Desplegado (requiere activación de clave) |

### 5.2 Ciclo de entrega por fase

Cada fase pasó por las siguientes etapas:

1. Diseño: definición de alcance funcional y técnico, identificación de dependencias
2. Implementación: desarrollo de componentes React/Next.js, edge functions Deno, migraciones Postgres
3. Build: compilación con verificación de TypeScript y generación estática
4. Commit: integración a la rama `main` con mensaje convencional
5. Despliegue automático: Vercel publica el cambio en producción al recibir el push
6. Verificación: pruebas en el entorno productivo y validación con datos reales

### 5.3 Buenas prácticas aplicadas

- Multi-tenant seguro por defecto: Row Level Security (RLS) de Postgres
- Server Components first: páginas renderizadas en servidor para óptimo SEO y rendimiento
- Composición de componentes reutilizables entre módulos
- Fall-backs explícitos: datos meteorológicos antiguos se muestran con marca visual
- Edge functions sin nuevas dependencias: reuso de la API key existente de Gemini
- Despliegue continuo desde GitHub a Vercel

---

## 6. ARQUITECTURA TECNOLÓGICA

| Capa | Tecnología | Rol |
|------|-----------|-----|
| Frontend | Next.js 16 (App Router) + React + TypeScript | Interfaz web responsive |
| Estilos | Tailwind CSS v4 con dark mode | Diseño consistente, profesional |
| Backend de aplicación | Supabase (Postgres + PostgREST + Auth) | Datos, autenticación, autorización |
| Funciones backend | Supabase Edge Functions (Deno) | Lógica con claves privadas o cómputo intensivo |
| Hosting | Vercel | Despliegue continuo desde GitHub |
| IA conversacional | Google Gemini 1.5 Flash | Asistente agronómico |
| IA de razonamiento | Anthropic Claude | Predictor de siembra |
| Datos meteorológicos | API WeatherLink (estaciones Davis) | Lecturas en tiempo real |
| Pronóstico extendido | Modelo GFS vía API | Pronóstico de 7 días |
| Visualización de datos | Recharts + SVG nativo | Componentes de visualización |
| Iconografía | Lucide React | Iconos consistentes y livianos |
| Modelo de seguridad | RLS de Postgres + JWT | Aislamiento de datos por agricultor |

---

## 7. CAMINO AL MVP — QUÉ NOS FALTA PARA EL PRODUCTO MÍNIMO VIABLE

### 7.1 Definición operativa de MVP

Para el contexto de Polar definimos MVP como: la versión mínima del producto que **un agricultor real puede usar productivamente durante un ciclo completo de cultivo** (siembra → cosecha) sin asistencia del equipo de desarrollo, y que **el equipo agronómico de Polar puede operar para todos los 20 agricultores** sin generar fricción operativa.

La distinción clave es: hoy estamos en estado de **prototipo funcional desplegado**, no en MVP. Cinco fases están en producción y la operación está armada, pero quedan brechas que impedirían un piloto real con los 20 agricultores hoy mismo.

### 7.2 Brechas para alcanzar MVP — Bloque 1 — Datos y operación

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Cron WeatherLink confiable | ~50% de las llamadas devuelven HTTP 400 (visible en logs) | Investigar y resolver causa raíz; alcanzar mínimo 95% de éxito |
| Frescura de lecturas Davis | Última lectura registrada: agosto 2025 (8 meses atrás) | Datos al día con latencia máxima de 30 minutos |
| Frescura del pronóstico GFS | Último pronóstico: 4 de abril 2026 (14 días atrás) | Cron de pronóstico ejecutándose diariamente |
| Mapeo de estaciones a agricultores | 16 de 20 agricultores mapeados; el piloto Luigi mapeado a estación ajena por workaround | Mapeo real 1:1 verificado por equipo agronómico |
| Cobertura del predictor de siembra | Funciona solo para agricultores con estación Davis | Definir UX cuando no hay estación local |

### 7.3 Brechas para alcanzar MVP — Bloque 2 — Onboarding y autenticación

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Usuarios registrados | 2 perfiles (1 master, 1 farmer demo) | 1 master operacional + 20 farmer activos |
| Proceso de alta de agricultor | Manual desde panel Supabase | Procedimiento documentado, ejecutable por administrador no técnico |
| Recuperación de contraseña | No probada | Flujo funcional vía email |
| Perfil del agricultor | Solo email y agricultor_key | Datos de contacto, teléfono, foto opcional |
| Multi-factor para master | No implementado | MFA obligatorio para rol master |

### 7.4 Brechas para alcanzar MVP — Bloque 3 — Experiencia de usuario

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Versión móvil validada | App es responsive pero no probada exhaustivamente en móvil | Flujos críticos funcionando bien en pantallas de 360 px |
| Estados vacíos | Cubiertos parcialmente | Cada módulo con mensaje claro cuando no hay datos |
| Mensajes de error | Mejorados en chat IA | Patrón consistente en todos los módulos |
| Documentación para usuario | Inexistente | Guía en PDF de 2-3 páginas por rol |
| Onboarding in-app | No implementado | Tour guiado para primer login |

### 7.5 Brechas para alcanzar MVP — Bloque 4 — Operación y soporte

| Brecha | Estado actual | Necesario para MVP |
|---|---|---|
| Activación de Gemini API | Pendiente | Clave válida configurada en Supabase |
| Envío de reportes por email (Fase E) | No iniciado | Funcional vía Resend |
| Monitoreo y alertas operativas | Solo logs en Supabase y Vercel | Alertas a un canal (email/Slack) ante caída del cron o errores 5xx |
| Backup y restauración | Cobertura por defecto de Supabase | Procedimiento documentado de restore por agricultor |
| Plan de soporte L1 | Indefinido | Quién responde dudas, en qué plazo, vía qué canal |

### 7.6 Estimación de esfuerzo para llegar al MVP

| Bloque | Esfuerzo estimado |
|---|---|
| Resolver crons y frescura de datos | 4 a 8 horas de investigación y fix |
| Onboarding sistemático de los 20 agricultores | 8 a 12 horas |
| Validación móvil + correcciones | 8 a 16 horas |
| Activar Gemini + Fase E | 2 a 3 horas |
| Documentación de usuario y soporte L1 | 4 a 8 horas |
| **Total** | **26 a 47 horas (~1 semana de trabajo enfocado)** |

---

## 8. CRUXES — LOS PUNTOS CRÍTICOS QUE ESTAMOS ATRAVESANDO

Un crux es la pregunta o problema central cuya respuesta determina si el proyecto tiene éxito o fracasa. A diferencia de un riesgo (que puede o no materializarse), un crux es un **nudo que necesariamente debemos atravesar** para consolidar el producto.

### 8.1 Crux 1 — Calidad y frescura de los datos meteorológicos

**Descripción:** Toda la propuesta de valor —predictor IA, alertas, pronóstico, asistente— se apoya en datos meteorológicos. Los logs muestran que el cron WeatherLink falla intermitentemente (aproximadamente la mitad de las llamadas devuelven HTTP 400) y que las últimas lecturas tienen meses de antigüedad.

**Por qué es crux:** sin datos frescos y confiables, el predictor da recomendaciones obsoletas, las alertas no llegan a tiempo y el chat IA pierde su contexto. La plataforma se convierte en una vista bonita sin valor de decisión real.

**Hipótesis de mitigación:** auditar el cron WeatherLink, resolver el origen de los HTTP 400, instalar monitoreo proactivo del estado del pipeline de datos, definir SLA interno de frescura.

### 8.2 Crux 2 — Adopción real por parte de los agricultores

**Descripción:** Los 20 agricultores del programa son productores rurales en los llanos venezolanos. Su perfil socio-demográfico, nivel de digitalización y disposición a usar una web app son inciertos.

**Por qué es crux:** un producto bien construido sin adopción equivale a no tener producto. Si la mayoría sigue prefiriendo llamadas telefónicas o visitas, la inversión no se materializa en cambio de comportamiento.

**Hipótesis de mitigación:** piloto controlado con 3 a 5 agricultores antes del rollout completo, sesiones de onboarding presencial, instrumentación de uso para detectar fricción temprana, métricas de activación y retención.

### 8.3 Crux 3 — Confianza organizacional en recomendaciones de IA

**Descripción:** El predictor de siembra emite fechas óptimas con score y reasoning. ¿Qué ocurre cuando la IA recomienda sembrar el 15 de abril y un agrónomo de Polar con 20 años de experiencia recomienda el 1 de mayo? ¿Quién prevalece? ¿Quién es responsable si la cosecha falla?

**Por qué es crux:** sin un protocolo claro de gobernanza de recomendaciones IA, el equipo agronómico va a desactivar la herramienta o ignorarla, y los agricultores recibirán mensajes contradictorios de Polar y de la plataforma.

**Hipótesis de mitigación:** definir explícitamente que la IA es asistente de decisión, no decisor; acordar con el equipo agronómico un proceso donde un humano valida cada recomendación crítica antes de comunicarla; medir consistencia IA vs experto durante un ciclo y ajustar.

### 8.4 Crux 4 — Conectividad rural en zonas de los agricultores

**Descripción:** La plataforma es 100% web y requiere conexión en tiempo real para autenticarse y cargar datos. Las fincas en los llanos venezolanos pueden tener conectividad intermitente o nula.

**Por qué es crux:** un agricultor que necesita la herramienta justo cuando hay tormenta —y se queda sin internet— no la usará la próxima vez. La utilidad percibida cae a cero en el momento de mayor estrés.

**Hipótesis de mitigación:** evaluar progresivamente PWA con caché offline; canales alternativos como SMS o WhatsApp para alertas críticas; mapear qué agricultores tienen conectividad estable vs intermitente y diseñar UX por segmento.

### 8.5 Crux 5 — Concentración de privilegios en el rol master

**Descripción:** Un único usuario master puede leer la información de los 20 agricultores. Si ese usuario o sus credenciales se ven comprometidos, hay una brecha de datos masiva.

**Por qué es crux:** la confianza del programa de Agricultura por Contrato depende de proteger información sensible (rendimientos, hectáreas, ubicaciones). Una filtración erosiona la relación con los productores y el reputational risk para Polar es alto.

**Hipótesis de mitigación:** implementar auth multi-factor obligatorio para master; auditoría completa de accesos; segregar perfiles dentro del rol master (master agronómico solo lee, master administrativo modifica); rotación periódica de credenciales.

### 8.6 Crux 6 — Costo unitario al escalar

**Descripción:** Las llamadas a Gemini, a Anthropic Claude, a la API de WeatherLink y al hosting de Vercel tienen costos variables. Hoy con un agricultor demo el costo es marginal; con 20 agricultores activos el costo se multiplica.

**Por qué es crux:** el programa puede crecer a 50 o 100 agricultores en años siguientes. Si el costo unitario es alto, el ROI deja de ser positivo o requiere replantear el modelo de financiamiento.

**Hipótesis de mitigación:** modelar costo por agricultor activo al mes incorporando todas las APIs; introducir caching de respuestas comunes; explorar tarifas empresariales o alternativas de modelos más económicos (Gemini Flash 8B, Claude Haiku).

### 8.7 Crux 7 — Coexistencia con sistemas existentes de Polar

**Descripción:** Polar opera con SAP y otros sistemas internos para gestión de proveedores y compras. La data de agropecuarias y lotes probablemente reside o se debería sincronizar con esos sistemas.

**Por qué es crux:** si la plataforma se vuelve un "sistema sombra" sin sincronización con el ERP corporativo, generaremos discrepancias que minarán su credibilidad. Si exige doble carga manual, la fricción operativa la mata.

**Hipótesis de mitigación:** mapear flujos de datos con el equipo de IT corporativo de Polar; definir si la plataforma es source of truth o consume del ERP; planificar integración (API o ETL) cuando sea viable.

### 8.8 Crux 8 — Gobernanza y mantenimiento post-launch

**Descripción:** Una vez lanzado, ¿quién mantiene la plataforma? ¿Quién responde cuando el cron falla a medianoche? ¿Quién decide cuándo actualizar de Next 16 a Next 17? ¿Quién paga las facturas mensuales de Vercel y Supabase?

**Por qué es crux:** sin un dueño operacional definido, los problemas se acumulan y la plataforma se degrada hasta volverse inutilizable en 6-12 meses.

**Hipótesis de mitigación:** definir antes del lanzamiento un acuerdo SLA con el equipo de soporte (interno o externo); transferir conocimiento técnico documentado; establecer cadencia de actualizaciones; presupuesto operativo anual asignado.

### 8.9 Resumen de cruxes por categoría

| Crux | Categoría | Probabilidad de impacto si no se atiende |
|---|---|---|
| 1. Calidad de datos meteorológicos | Técnico | Alta |
| 2. Adopción del agricultor | Comportamental | Alta |
| 3. Confianza en IA | Organizacional | Media-alta |
| 4. Conectividad rural | Infraestructura | Media |
| 5. Concentración de privilegios | Seguridad | Media |
| 6. Costo unitario al escalar | Económico | Media |
| 7. Coexistencia con sistemas Polar | Integración | Media-alta |
| 8. Gobernanza post-launch | Operacional | Alta |

---

## 9. RIESGOS OPERATIVOS Y MITIGACIONES

A diferencia de los cruxes (problemas estructurales no resueltos), los riesgos operativos son eventos puntuales con mitigaciones ya implementadas o planificadas en el código.

| Riesgo | Probabilidad | Impacto | Mitigación implementada |
|--------|--------------|---------|--------------------------|
| Datos meteorológicos atrasados (estación caída) | Media | Medio | Fall-back automático al último batch disponible con marca visual de "datos antiguos" |
| Falla de Gemini API (cuota, indisponibilidad) | Baja | Bajo | Mensajes de error contextuales; las decisiones operativas no dependen exclusivamente del chat |
| Acceso indebido entre agricultores | Baja | Alto | RLS de Postgres por `agricultor_key` + Supabase Auth con JWT |
| Caída del cron WeatherLink | Media | Medio | Logs visibles en Supabase; sincronización cada 15 min con detección de gaps (parcial) |
| Rotación de API keys | Baja | Bajo | Centralizadas en Supabase Secrets, sin estar en código fuente |
| Pérdida de sesión de usuario | Baja | Bajo | Token JWT renovable automáticamente |

---

## 10. CONCLUSIONES Y RECOMENDACIÓN

### 10.1 Estado del proyecto

La plataforma "Proyecto Saturno" cumple los objetivos planteados al inicio del proyecto a nivel de prototipo:

1. Centralizar la operación del Programa de Agricultura por Contrato en una única interfaz
2. Aplicar inteligencia artificial al proceso agronómico (predictor de siembra y asistente conversacional)
3. Anticipar riesgos climáticos con alertas a 7 días
4. Profesionalizar la trazabilidad del cultivo y la cosecha
5. Escalar la asistencia técnica sin incrementar costos operativos lineales

Cinco de las seis fases planificadas están en producción. Para alcanzar un MVP listo para piloto formal con los 20 agricultores se requiere cerrar las brechas detalladas en la sección 7 (estimación: una semana de trabajo enfocado) y atender de forma activa los cruxes de la sección 8.

### 10.2 Recomendación a la junta

1. **Aprobar el cierre de brechas para alcanzar MVP** según el plan de la sección 7 (aproximadamente una semana)
2. **Autorizar la activación** de la API key de Gemini para habilitar el asistente
3. **Asignar responsables explícitos** para los cruxes 3, 7 y 8 (gobernanza de IA, integración con sistemas Polar y mantenimiento post-launch) — estos cruxes no se resuelven con código sino con decisiones organizacionales
4. **Lanzar un piloto controlado** con 3 a 5 agricultores antes del rollout a los 20, para validar las hipótesis de adopción identificadas en la sección 2.5
5. **Iniciar planificación** del roadmap post-launch:
   - Notificaciones SMS/WhatsApp (atiende cruxes 2 y 4)
   - Mapa satelital
   - Comparativos año contra año
   - App móvil nativa con modo offline
6. Considerar la **expansión del programa** a más agricultores aprovechando la plataforma, una vez validados los cruxes

---

**Documento generado el 18 de abril de 2026.**
**Repositorio del producto:** github.com/perez-luis-netizen/agri-platform
**Entorno productivo:** https://agri-platform-omega.vercel.app
