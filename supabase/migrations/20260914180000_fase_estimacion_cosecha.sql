-- Tercera vuelta (Jose Gregorio Balza, G04): actividad hasta el 09/sep,
-- pero "Se realizo la estimacion de cosecha correspondiente a el lote con
-- exito" (20/ago) no matcheaba ningun patron -- "estimacion de cosecha" y
-- "estimacion de rendimiento" son la misma familia de actividad de cierre
-- de ciclo que secado/humedad de grano (se hacen en la misma ventana,
-- R5-R6), solo que con otra redaccion.

create or replace function public.saturno_extraer_fase_de_texto(p text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select upper(m[1])
      from regexp_matches(coalesce(p, ''), '\m([VvRr][0-9]{1,2})\M', 'g') as m
      where public.saturno_fase_avance_pct(upper(m[1])) is not null
      order by public.saturno_fase_avance_pct(upper(m[1])) desc
      limit 1
    ),
    case
      when p ~* '(secado del? grano|secado de la mazorca|secado de mazorca|capa negra|madurez fisiol[oó]gica|punto de cosecha|listos? para cosech|inicio de cosecha|humedad del? grano|prueba de humedad|estimaci[oó]n de cosecha|estimaci[oó]n de rendimiento)'
        then 'R6'
      else null
    end
  )
$$;

select public.saturno_refrescar_derivados();
