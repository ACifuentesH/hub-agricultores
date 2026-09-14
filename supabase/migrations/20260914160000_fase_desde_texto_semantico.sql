-- Segunda vuelta del fix anterior (20260914150000), con evidencia de Dennis
-- Alibardi (P10): el tecnico SI visita semanalmente (Sajida Zamora, 04/08/10/
-- 11/12/13/18-ago, confirmado bajando el volcado), y describe un cultivo muy
-- avanzado -- "monitoreo del secado del grano", "proceso de secado de la
-- mazorca, aun sin agobio" -- pero saturno_extraer_fase_de_texto() solo
-- reconocia codigos explicitos tipo "R3"/"V7". "Secado de grano" es la fase
-- R6 (madurez fisiologica, previo a cosecha) descrita en palabras, no en
-- codigo, y no matcheaba con nada.
--
-- Se agrega un segundo nivel de reconocimiento: frases de cierre de ciclo
-- (secado de grano/mazorca, capa negra, madurez fisiologica, punto de
-- cosecha, prueba de humedad de grano) mapean a R6 cuando no hay un codigo
-- V/R explicito en el mismo comentario. Son frases inequivocas de esa etapa
-- especifica -- no se agregan frases ambiguas tipo "llenado" o "formacion"
-- que podrian ser R3, R4 o R5 segun el contexto, para no sobrestimar.

create or replace function public.saturno_extraer_fase_de_texto(p text)
returns text
language sql
immutable
as $$
  select coalesce(
    -- 1) Codigo explicito V##/R#, el mas avanzado si hay varios.
    (
      select upper(m[1])
      from regexp_matches(coalesce(p, ''), '\m([VvRr][0-9]{1,2})\M', 'g') as m
      where public.saturno_fase_avance_pct(upper(m[1])) is not null
      order by public.saturno_fase_avance_pct(upper(m[1])) desc
      limit 1
    ),
    -- 2) Frases inequivocas de cierre de ciclo (madurez fisiologica / previo
    --    a cosecha), sin codigo explicito en el texto.
    case
      when p ~* '(secado del? grano|secado de la mazorca|secado de mazorca|capa negra|madurez fisiol[oó]gica|punto de cosecha|listos? para cosech|inicio de cosecha|humedad del? grano|prueba de humedad)'
        then 'R6'
      else null
    end
  )
$$;

-- Refrescar con el reconocimiento nuevo.
select public.saturno_refrescar_derivados();
