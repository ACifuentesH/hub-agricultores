-- Cuarta vuelta: revisando los lotes que seguian sin dato, aparece repetida
-- la frase "aplicacion de cierre del cultivo... proteccion de la etapa
-- final" -- es la ultima fumigacion antes de la etapa final del cultivo,
-- un hito agronomico razonablemente especifico. Se mapea a R3 (conservador:
-- es la ultima aplicacion QUIMICA posible, no necesariamente ya en llenado
-- de grano avanzado).
--
-- Deliberadamente NO se agregan aqui frases mas ambiguas que aparecieron en
-- la misma revision ("se fumigo con dron por la altura del cultivo",
-- "evaluacion del proceso de llenado para estimacion PMG") -- podrian
-- corresponder a un rango amplio de etapas y mapearlas seria adivinar, que
-- es exactamente lo que el usuario pidio dejar de hacer.

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
      when p ~* 'aplicaci[oó]n de cierre'
        then 'R3'
      else null
    end
  )
$$;

select public.saturno_refrescar_derivados();
