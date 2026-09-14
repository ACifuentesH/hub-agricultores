-- v_agricultor_resumen contaba lotes_muy_buenos/buenos/regulares/malos desde
-- estado_experto crudo, sin el mismo filtro de 30 dias que ya tiene
-- fase_dominante (20260914120000) -- por eso Angela Guedez seguia viendo
-- "7 Regular, 1 Malo" en la tarjeta aunque esas valoraciones sean de mayo.

create or replace view public.v_agricultor_resumen
with (security_invoker = true) as
select
  l.agricultor_id,
  l.ciclo,
  count(*) as lotes,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) in ('muy bueno', 'excelente')
  ) as lotes_muy_buenos,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'bueno'
  ) as lotes_buenos,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'regular'
  ) as lotes_regulares,
  count(*) filter (
    where d.fecha_visita >= current_date - 30
      and lower(coalesce(d.estado_experto, '')) = 'malo'
  ) as lotes_malos,
  count(*) filter (
    where d.estado_experto is null
      or d.fecha_visita is null
      or d.fecha_visita < current_date - 30
  ) as lotes_sin_evaluar,
  mode() within group (order by d.fase)
    filter (where d.fase is not null and d.fecha_visita >= current_date - 30) as fase_dominante,
  count(*) filter (where d.fase is not null and d.fecha_visita >= current_date - 30) as lotes_con_fase,
  avg(d.avance_pct) as avance_promedio
from public.lotes l
left join public.lote_derivado d on d.lote_id = l.lote_id
group by l.agricultor_id, l.ciclo;
