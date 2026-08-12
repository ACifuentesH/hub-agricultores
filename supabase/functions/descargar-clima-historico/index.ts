import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const NASA_PARAMS = [
  'T2M','T2M_MAX','T2M_MIN','PRECTOTCORR','RH2M','ALLSKY_SFC_SW_DWN','WS10M_MAX','EVPTRNS',
].join(',')

const VARS_FC = 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,shortwave_radiation_sum,relative_humidity_2m_mean,wind_speed_10m_max'

async function upsert(sb:any,tabla:string,rows:any[],conflict:string){
  for(let i=0;i<rows.length;i+=500){
    const{error}=await sb.from(tabla).upsert(rows.slice(i,i+500),{onConflict:conflict})
    if(error) console.error(`upsert ${tabla}:`,error.message)
  }
}

async function nasaPower(lat:number,lon:number,inicio:string,fin:string){
  const start=inicio.replaceAll('-','')
  const end=fin.replaceAll('-','')
  const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${NASA_PARAMS}&community=AG&longitude=${lon}&latitude=${lat}&start=${start}&end=${end}&format=JSON`
  const res=await fetch(url,{headers:{'Accept':'application/json'}})
  if(!res.ok) throw new Error(`NASA POWER ${res.status}: ${await res.text()}`)
  return await res.json()
}

Deno.serve(async(req)=>{
  const sb=createClient(SUPABASE_URL,SUPABASE_KEY)
  const url=new URL(req.url)
  const modo      =url.searchParams.get('modo')      ?? 'historico'
  const productor =url.searchParams.get('productor')
  const inicio    =url.searchParams.get('inicio')    ?? '2000-01-01'
  const fin       =url.searchParams.get('fin')       ?? new Date().toISOString().split('T')[0]

  const{data:prods}=await sb.from('productor_coordenadas').select('productor_clima,lat,lon')
  const vistos=new Set<string>()
  let unicos=(prods??[]).filter((p:any)=>{
    const k=`${p.lat.toFixed(2)},${p.lon.toFixed(2)}`
    if(vistos.has(k)) return false
    vistos.add(k); return true
  })
  if(productor) unicos=unicos.filter((p:any)=>p.productor_clima.toLowerCase().includes(productor.toLowerCase()))

  const detalle:Record<string,any>={}
  let totalHist=0,totalFc=0

  if(modo==='historico'||modo==='todo'){
    for(const p of unicos){
      try{
        console.log(`NASA POWER: ${p.productor_clima} ${inicio}→${fin}`)
        const data=await nasaPower(p.lat,p.lon,inicio,fin)
        const props=data?.properties?.parameter??{}
        const fechasRaw:string[]=Object.keys(props['T2M']??{})
        const rows=fechasRaw.map(f=>{
          const fecha=`${f.slice(0,4)}-${f.slice(4,6)}-${f.slice(6,8)}`
          const t2m=props['T2M']?.[f],tmax=props['T2M_MAX']?.[f],tmin=props['T2M_MIN']?.[f]
          const lluvia=props['PRECTOTCORR']?.[f],hum=props['RH2M']?.[f]
          const rad=props['ALLSKY_SFC_SW_DWN']?.[f],viento=props['WS10M_MAX']?.[f],et=props['EVPTRNS']?.[f]
          return{
            productor_clima:p.productor_clima,fecha,fuente:'nasa-power',
            temp_avg_c:     (t2m   !=null&&t2m   >-900)?+t2m.toFixed(2)    :null,
            temp_max_c:     (tmax  !=null&&tmax  >-900)?+tmax.toFixed(2)   :null,
            temp_min_c:     (tmin  !=null&&tmin  >-900)?+tmin.toFixed(2)   :null,
            lluvia_mm:      (lluvia!=null&&lluvia>-900)?+lluvia.toFixed(2)  :null,
            hum_avg_pct:    (hum   !=null&&hum   >-900)?+hum.toFixed(1)    :null,
            rad_solar_mjm2: (rad   !=null&&rad   >-900)?+rad.toFixed(2)    :null,
            viento_max_kmh: (viento!=null&&viento>-900)?+(viento*3.6).toFixed(1):null,
            et0_mm:         (et    !=null&&et    >-900)?+et.toFixed(2)     :null,
          }
        }).filter(r=>r.temp_avg_c!==null)
        await upsert(sb,'clima_historico_global',rows,'productor_clima,fecha,fuente')
        detalle[p.productor_clima]=`${rows.length} dias OK`
        totalHist+=rows.length
      }catch(e:any){
        detalle[p.productor_clima]=`ERROR: ${e.message}`
      }
      await new Promise(r=>setTimeout(r,600))
    }
  }

  if(modo==='forecast'||modo==='todo'){
    for(const p of unicos){
      try{
        const apiUrl=`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=${VARS_FC}&timezone=America%2FCaracas&forecast_days=16&wind_speed_unit=kmh`
        const data=await fetch(apiUrl).then(r=>r.json())
        if(data.error) throw new Error(data.reason)
        const d=data.daily??{}
        const fechas:string[]=d.time??[]
        const rows=fechas.map((fecha:string,i:number)=>({
          productor_clima:p.productor_clima,fecha,
          temp_max_c:     d.temperature_2m_max?.[i]            ??null,
          temp_min_c:     d.temperature_2m_min?.[i]            ??null,
          temp_avg_c:     d.temperature_2m_mean?.[i]           ??null,
          lluvia_mm:      d.precipitation_sum?.[i]             ??null,
          prob_lluvia_pct:d.precipitation_probability_max?.[i] ??null,
          et0_mm:         d.et0_fao_evapotranspiration?.[i]    ??null,
          rad_solar_mjm2: d.shortwave_radiation_sum?.[i]       ??null,
          hum_avg_pct:    d.relative_humidity_2m_mean?.[i]     ??null,
          viento_max_kmh: d.wind_speed_10m_max?.[i]            ??null,
        }))
        await upsert(sb,'clima_forecast',rows,'productor_clima,fecha')
        detalle[`fc_${p.productor_clima}`]=`${rows.length} dias OK`
        totalFc+=rows.length
      }catch(e:any){
        detalle[`fc_${p.productor_clima}`]=`ERROR: ${e.message}`
      }
      await new Promise(r=>setTimeout(r,200))
    }
  }

  if(modo==='enso'||modo==='todo'){
    try{
      const txt=await fetch('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt').then(r=>r.text())
      const rows:any[]=[]
      for(const line of txt.trim().split('\n').slice(1)){
        const parts=line.trim().split(/\s+/)
        if(parts.length>=3){
          const oni=parseFloat(parts[2])
          if(!isNaN(oni)) rows.push({
            fecha:`${parts[0]}-${parts[1].padStart(2,'0')}-01`,
            oni,fuente:'noaa_cpc',
            fase:oni>=0.5?'el_nino':oni<=-0.5?'la_nina':'neutro'
          })
        }
      }
      await upsert(sb,'enso_index',rows,'fecha')
      detalle['enso']=`${rows.length} meses OK`
    }catch(e:any){
      detalle['enso']=`ERROR: ${e.message}`
    }
  }

  // Modo especial: recalcular percentiles ENSO en DB
  if(modo==='percentiles'){
    try{
      const{data,error}=await sb.rpc('recalcular_percentiles_enso')
      if(error) throw error
      detalle['percentiles']=`${data} filas calculadas OK`
    }catch(e:any){
      detalle['percentiles']=`ERROR: ${e.message}`
    }
  }

  return new Response(JSON.stringify({
    ok:true,modo,inicio,fin,
    productores_procesados:unicos.length,
    total_historico:totalHist,
    total_forecast:totalFc,
    detalle
  },null,2),{headers:{'Content-Type':'application/json'}})
})
