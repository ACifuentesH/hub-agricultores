// clima-promedio-export v4
// CAMBIO CLAVE: buildClimaPromedio ahora usa lluvia real Davis aunque no haya temperatura.
// Jerarquía por día:
//   1. Davis completo (temp+lluvia)  → todo de Davis
//   2. Davis solo lluvia             → lluvia=Davis real, temp/hum/et0=ERA5
//   3. Solo ERA5                     → todo ERA5
// Temperatura/hum/et0 siempre de ERA5 cuando Davis no las tiene.
// enso_filter=all|nino|nina|neutral sigue disponible.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS   = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

type EnsoPhase  = "nino"|"nina"|"neutral";
type EnsoFilter = "all"|EnsoPhase;

const ENSO_YEAR: Record<number, EnsoPhase> = {
  2000:"nina",2001:"neutral",2002:"nino",2003:"neutral",2004:"neutral",
  2005:"neutral",2006:"neutral",2007:"nina",2008:"nina",2009:"nino",
  2010:"nina",2011:"nina",2012:"neutral",2013:"neutral",2014:"neutral",
  2015:"nino",2016:"neutral",2017:"neutral",2018:"neutral",2019:"neutral",
  2020:"neutral",2021:"nina",2022:"nina",2023:"nino",2024:"neutral",
  2025:"nina",2026:"nino",
};
const ENSO_LABELS: Record<EnsoFilter,string> = {
  all:"Todos los años",nino:"El Niño (ONI≥+0.5)",nina:"La Niña (ONI≤-0.5)",neutral:"Neutro",
};

interface Day {
  date:string;tmax:number;tmin:number;tavg:number;
  rain:number;et0:number;hum:number;
  source:"davis"|"davis_rain_era5"|"davis_median"|"forecast"|"chirps_nasa"|"historico_db"|"clima_promedio";
}
interface PromedioDia{tmax:number;tmin:number;tavg:number;rain:number;et0:number;hum:number;n_years:number;}

function doyToDate(year:number,doy:number):string{
  const d=new Date(year,0,1);d.setDate(d.getDate()+doy-1);return fmtYMD(d);
}
function fmtYMD(d:Date):string{
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseYMD(ymd:string):Date{
  const[y,m,d]=ymd.split("-").map(Number);return new Date(y,m-1,d,12,0,0);
}
function cmpYMD(a:string,b:string):number{return a<b?-1:a>b?1:0;}
function isoWeek(d:Date):number{
  const u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=u.getUTCDay()||7;u.setUTCDate(u.getUTCDate()+4-day);
  const y=new Date(Date.UTC(u.getUTCFullYear(),0,1));
  return Math.ceil((((u.getTime()-y.getTime())/86400000)+1)/7);
}
function et0H(tmax:number,tmin:number,tavg:number,doy:number,lat:number):number{
  const lr=lat*Math.PI/180,dr=1+0.033*Math.cos(2*Math.PI*doy/365);
  const dc=0.409*Math.sin(2*Math.PI*doy/365-1.39);
  const ws=Math.acos(Math.max(-1,Math.min(1,-Math.tan(lr)*Math.tan(dc))));
  const Ra=24*60/Math.PI*0.082*dr*(ws*Math.sin(lr)*Math.sin(dc)+Math.cos(lr)*Math.cos(dc)*Math.sin(ws));
  return 0.0023*Ra*Math.sqrt(Math.max(0,tmax-tmin))*(tavg+17.8);
}
const vpd=(t:number,rh:number)=>Math.max(0,(1-rh/100)*0.6108*Math.exp(17.27*t/(t+237.3))*10);
const gdu=(tmax:number,tmin:number)=>Math.max(0,(Math.min(tmax,40)+tmin)/2-10);

function trunc(obj:Record<string,Record<string,number>>,chirps:Record<string,number>,asOf:string){
  for(const k of Object.keys(obj)) if(cmpYMD(k,asOf)>0) delete obj[k];
  for(const k of Object.keys(chirps)) if(cmpYMD(k,asOf)>0) delete chirps[k];
}
function truncOM(om:{nasa:Record<string,Record<string,number>>;chirps:Record<string,number>},asOf:string){
  for(const k of Object.keys(om.nasa)) if(cmpYMD(k,asOf)>0) delete om.nasa[k];
  for(const k of Object.keys(om.chirps)) if(cmpYMD(k,asOf)>0) delete om.chirps[k];
}
function mergeN(a:Record<string,Record<string,number>>,b:Record<string,Record<string,number>>):Record<string,Record<string,number>>{return{...a,...b};}
function mergeR(sat:Record<string,number>,fb:Record<string,number>):Record<string,number>{
  const o:Record<string,number>={...fb};
  for(const[k,v] of Object.entries(sat)){if(v==null||isNaN(v))continue;const c=Math.max(0,+v);if(c>0){o[k]=c;continue;}if(o[k]==null)o[k]=0;}
  return o;
}

async function getOM(lat:number,lon:number,s:string,e:string):Promise<{nasa:Record<string,Record<string,number>>;chirps:Record<string,number>}>{
  try{
    const v="temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,et0_fao_evapotranspiration,relative_humidity_2m_mean";
    const j=await(await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${s}&end_date=${e}&daily=${v}&timezone=America%2FCaracas`)).json();
    const d=j.daily;if(!d?.time?.length)return{nasa:{},chirps:{}};
    const nasa:Record<string,Record<string,number>>={},chirps:Record<string,number>={};
    for(let i=0;i<d.time.length;i++){
      const dt=d.time[i] as string;
      const tmax=d.temperature_2m_max?.[i],tmin=d.temperature_2m_min?.[i],tavg=d.temperature_2m_mean?.[i];
      if(tmax==null||tmin==null||tavg==null)continue;
      nasa[dt]={tmax:+tmax,tmin:+tmin,tavg:+tavg,et0:d.et0_fao_evapotranspiration?.[i]!=null?+d.et0_fao_evapotranspiration[i]:0,hum:d.relative_humidity_2m_mean?.[i]!=null?+d.relative_humidity_2m_mean[i]:70};
      chirps[dt]=d.precipitation_sum?.[i]!=null?Math.max(0,+d.precipitation_sum[i]):0;
    }
    return{nasa,chirps};
  }catch{return{nasa:{},chirps:{}}}
}

async function getDavisFull(sb:ReturnType<typeof createClient>,productor:string):Promise<Day[]>{
  const{data,error}=await sb.rpc("get_davis_daily",{p_productor:productor});
  const rows=data as Record<string,string>[]|null;
  if(error||!rows?.length)return[];
  return rows.map(r=>({date:r.fecha,source:"davis" as const,tmax:parseFloat(r.temp_max)||0,tmin:parseFloat(r.temp_min)||0,tavg:parseFloat(r.temp_avg)||0,rain:parseFloat(r.lluvia_mm)||0,et0:parseFloat(r.et0_mm)||0,hum:parseFloat(r.hum_avg)||70}));
}

async function getDavisRainOnly(sb:ReturnType<typeof createClient>,productor:string):Promise<Map<string,number>>{
  // Nueva RPC: lluvia real aunque no haya temperatura
  const{data,error}=await sb.rpc("get_davis_rain_only",{p_productor:productor});
  const rows=data as{fecha:string;lluvia_mm:string}[]|null;
  if(error||!rows?.length)return new Map();
  return new Map(rows.map(r=>[r.fecha,parseFloat(r.lluvia_mm)||0]));
}

async function getHistDB(sb:ReturnType<typeof createClient>,productor_clima:string,from:string,to:string):Promise<{rainFallback:Record<string,number>;nasa:Record<string,Record<string,number>>}>{
  try{
    const{data,error}=await sb.from("clima_historico_global").select("fecha,temp_max_c,temp_min_c,temp_avg_c,lluvia_mm,et0_mm,hum_avg_pct").eq("productor_clima",productor_clima).eq("fuente","nasa-power").gte("fecha",from).lte("fecha",to);
    if(error||!data?.length)return{rainFallback:{},nasa:{}};
    const rainFallback:Record<string,number>={},nasa:Record<string,Record<string,number>>={}
    for(const r of data as Record<string,unknown>[]){
      const ds=String(r.fecha).slice(0,10);
      const tmax=r.temp_max_c as number|null,tmin=r.temp_min_c as number|null,tavg=r.temp_avg_c as number|null;
      if(tmax!=null&&tmin!=null&&tavg!=null)nasa[ds]={tmax:+tmax,tmin:+tmin,tavg:+tavg,et0:r.et0_mm!=null?+(r.et0_mm as number):0,hum:r.hum_avg_pct!=null?+(r.hum_avg_pct as number):70};
      if(r.lluvia_mm!=null)rainFallback[ds]=+(r.lluvia_mm as number);
    }
    return{rainFallback,nasa};
  }catch{return{rainFallback:{},nasa:{}}}
}

async function getChirps(lat:number,lon:number,from:string,to:string):Promise<Record<string,number>>{
  try{
    const url=`https://climateserv.servirglobal.net/api/submitDataRequest/?datatype=26&begintime=${from.replaceAll("-","/")}&endtime=${to.replaceAll("-","/")}&intervaltype=0&operationtype=5&geometry={"type":"Point","coordinates":[${lon},${lat}]}`;
    const jobId=(await(await fetch(url)).json())?.[0];if(!jobId)return{};
    for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,3000));const p=await(await fetch(`https://climateserv.servirglobal.net/api/getDataRequestProgress/?id=${jobId}`)).json();if(p?.progress===100)break;}
    const data=await(await fetch(`https://climateserv.servirglobal.net/api/getDataFromRequest/?id=${jobId}`)).json();
    const out:Record<string,number>={};
    for(const e of(data?.[0]?.data??[]))if(e?.date&&e?.value!=null&&e.value!==-9999){const p=e.date.split("/");if(p.length===3)out[`${p[2]}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}`]=Math.max(0,+e.value||0);}
    return out;
  }catch{return{}}
}
async function getNASA(lat:number,lon:number,from:string,to:string):Promise<Record<string,Record<string,number>>>{
  try{
    const url=`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2M,EVPTRNS,RH2M&community=AG&longitude=${lon}&latitude=${lat}&start=${from.replaceAll("-","")}&end=${to.replaceAll("-","")}&format=JSON`;
    const p=(await(await fetch(url)).json())?.properties?.parameter??{};
    const out:Record<string,Record<string,number>>={}
    for(const f of Object.keys(p.T2M??{})){
      const tmax=p.T2M_MAX?.[f],tmin=p.T2M_MIN?.[f],tavg=p.T2M?.[f];
      if(tmax>-900&&tmin>-900)out[`${f.slice(0,4)}-${f.slice(4,6)}-${f.slice(6,8)}`]={tmax,tmin,tavg,et0:(p.EVPTRNS?.[f]??0)>-900?(p.EVPTRNS?.[f]??0):0,hum:(p.RH2M?.[f]??0)>-900?(p.RH2M?.[f]??0):70};
    }
    return out;
  }catch{return{}}
}

// ── buildClimaPromedio v4 ────────────────────────────────────────────────────
// Para cada día de cada año histórico:
//   1. Davis completo (temp≠null)  → lluvia+temp+hum de Davis
//   2. Davis solo lluvia (rainMap) → lluvia=Davis REAL, temp/hum/et0=ERA5
//   3. ERA5 disponible             → todo ERA5
// Esto garantiza que usamos TODA la lluvia real que tenemos en BD.
function buildClimaPromedio(
  davisFull: Day[],
  davisRainMap: Map<string,number>,   // lluvia real para TODOS los días con pluviómetro
  nasaAll: Record<string,Record<string,number>>,
  chirpsAll: Record<string,number>,
  omAll: Record<string,Record<string,number>>,
  omRain: Record<string,number>,
  seasonYear: number,
  lat: number,
  ef: EnsoFilter,
): Record<number,PromedioDia> {
  const acc:Record<number,{tmax:number[];tmin:number[];tavg:number[];rain:number[];et0:number[];hum:number[]}>={};
  for(let doy=121;doy<=273;doy++)acc[doy]={tmax:[],tmin:[],tavg:[],rain:[],et0:[],hum:[]};

  const allYears:number[]=[];for(let y=seasonYear-1;y>=seasonYear-6;y--)allYears.push(y);
  const years=ef==="all"?allYears:allYears.filter(y=>ENSO_YEAR[y]===ef);
  const davisMap=new Map(davisFull.map(d=>[d.date,d]));

  for(const year of years){
    const daysInYear:{doy:number;tmax:number;tmin:number;tavg:number;rain:number;et0:number;hum:number;src:string}[]=[];

    for(let doy=121;doy<=273;doy++){
      const ds=doyToDate(year,doy);

      // ── Fuente 1: Davis completo (temp + lluvia) ─────────────────────────
      const dv=davisMap.get(ds);
      if(dv&&dv.tmax>0){
        daysInYear.push({doy,tmax:dv.tmax,tmin:dv.tmin,tavg:dv.tavg,rain:dv.rain,et0:dv.et0>0.1?dv.et0:et0H(dv.tmax,dv.tmin,dv.tavg,doy,lat),hum:dv.hum,src:"davis_full"});
        continue;
      }

      // ── Fuente 2: Davis solo lluvia + ERA5 para temp/hum/et0 ────────────
      const davisRain=davisRainMap.get(ds);
      const omSrc=omAll[ds];
      if(davisRain!=null&&omSrc){
        // Lluvia REAL del pluviómetro Davis, temperatura de ERA5
        const et0val=omSrc.et0>0.1?omSrc.et0:et0H(omSrc.tmax,omSrc.tmin,omSrc.tavg,doy,lat);
        daysInYear.push({doy,tmax:omSrc.tmax,tmin:omSrc.tmin,tavg:omSrc.tavg,rain:davisRain,et0:et0val,hum:omSrc.hum,src:"davis_rain+era5_temp"});
        continue;
      }

      // ── Fuente 3: Solo ERA5 (temp + lluvia ERA5) ─────────────────────────
      const n=nasaAll[ds];
      const src=omSrc??n;
      if(src){
        const rain=omSrc?(omRain[ds]??chirpsAll[ds]??0):(chirpsAll[ds]??0);
        daysInYear.push({doy,tmax:src.tmax,tmin:src.tmin,tavg:src.tavg,rain,et0:src.et0>0.1?src.et0:et0H(src.tmax,src.tmin,src.tavg,doy,lat),hum:src.hum,src:"era5"});
      }
    }

    if(daysInYear.length<30)continue;
    for(const d of daysInYear){
      acc[d.doy].tmax.push(d.tmax);acc[d.doy].tmin.push(d.tmin);acc[d.doy].tavg.push(d.tavg);
      acc[d.doy].rain.push(d.rain);acc[d.doy].et0.push(d.et0);acc[d.doy].hum.push(d.hum);
    }
  }

  const avg=(arr:number[])=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
  const result:Record<number,PromedioDia>={};
  for(let doy=121;doy<=273;doy++){
    const a=acc[doy];if(!a.tmax.length)continue;
    result[doy]={tmax:+avg(a.tmax).toFixed(2),tmin:+avg(a.tmin).toFixed(2),tavg:+avg(a.tavg).toFixed(2),rain:+avg(a.rain).toFixed(2),et0:+avg(a.et0).toFixed(2),hum:+avg(a.hum).toFixed(2),n_years:a.tmax.length};
  }
  return result;
}

// ── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:{...CORS,"Access-Control-Allow-Methods":"GET","Access-Control-Allow-Headers":"*"}});
  const sb=createClient(SB_URL,SB_KEY);
  const url=new URL(req.url);
  const lat=parseFloat(url.searchParams.get("lat")??"");
  const lon=parseFloat(url.searchParams.get("lon")??"");
  const producerKey=(url.searchParams.get("producer")??"").trim();
  const seasonYearRaw=url.searchParams.get("season_year")??"2026";
  const asOfRaw=(url.searchParams.get("as_of")??"").trim();
  const rawF=url.searchParams.get("enso_filter")??"all";
  const ef:EnsoFilter=(["all","nino","nina","neutral"] as const).includes(rawF as EnsoFilter)?rawF as EnsoFilter:"all";

  if(isNaN(lat)||isNaN(lon))return new Response(JSON.stringify({ok:false,error:"Required: ?lat=&lon="}),{status:400,headers:CORS});
  const seasonYear=parseInt(seasonYearRaw,10);
  if(!Number.isFinite(seasonYear))return new Response(JSON.stringify({ok:false,error:"Invalid season_year"}),{status:400,headers:CORS});
  const asOf=/^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)?asOfRaw:`${seasonYear}-04-30`;

  try{
    const anchorYear=parseInt(asOf.slice(0,4),10);
    const gridStart=`${anchorYear-6}-01-01`,gridEnd=asOf;
    const priorStart=`${seasonYear-1}-05-01`,priorEnd=`${seasonYear-1}-09-30`;

    // Todas las fuentes en paralelo — incluyendo get_davis_rain_only (NUEVA)
    const[chirpsApi,nasaApi,histPack,omPrior,davisFullArr,davisRainMap]=await Promise.all([
      getChirps(lat,lon,gridStart,gridEnd),
      getNASA(lat,lon,gridStart,gridEnd),
      producerKey?getHistDB(sb,producerKey,gridStart,gridEnd):Promise.resolve({rainFallback:{},nasa:{}}),
      getOM(lat,lon,priorStart,priorEnd),
      producerKey?getDavisFull(sb,producerKey):Promise.resolve([] as Day[]),
      producerKey?getDavisRainOnly(sb,producerKey):Promise.resolve(new Map<string,number>()),
    ]);

    const omHistStart=`${seasonYear-6}-05-01`,omHistEnd=`${seasonYear-1}-09-30`;
    const omHistorico=await getOM(lat,lon,omHistStart,omHistEnd);

    let chirps=mergeR(chirpsApi,histPack.rainFallback);
    let nasa=mergeN(nasaApi,histPack.nasa);
    for(const[k,v] of Object.entries(omHistorico.nasa))if(!nasa[k])nasa[k]=v;
    for(const[k,v] of Object.entries(omHistorico.chirps))if(chirps[k]==null)chirps[k]=v;
    for(const k of Object.keys(histPack.nasa))if(nasa[k])(nasa[k] as Record<string,unknown>)._fromDb=true;
    trunc(nasa,chirps,asOf);
    truncOM(omPrior,asOf);

    // Prior-year fill para el año target
    const py=seasonYear-1;
    for(let dt=new Date(seasonYear,4,1);dt<=new Date(seasonYear,8,30);dt.setDate(dt.getDate()+1)){
      const ds=fmtYMD(dt);
      const prev=`${py}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
      const on=omPrior.nasa[prev];if(!nasa[ds]&&on)nasa[ds]={...on};
      if(chirps[ds]==null&&omPrior.chirps[prev]!=null)chirps[ds]=omPrior.chirps[prev];
    }

    // Filtrar Davis full por asOf
    const davisFiltered=davisFullArr.filter(d=>cmpYMD(d.date,asOf)<=0);
    // Filtrar rain-only por asOf también
    const davisRainFiltered=new Map<string,number>();
    for(const[k,v] of davisRainMap)if(cmpYMD(k,asOf)<=0)davisRainFiltered.set(k,v);

    // Estadísticas de cobertura Davis
    const davisRainDays=davisRainFiltered.size;
    const davisFullDays=davisFiltered.length;
    const davisRainOnlyDays=davisRainDays-davisFullDays;

    const climaPromedio=buildClimaPromedio(
      davisFiltered,davisRainFiltered,nasa,chirps,omHistorico.nasa,omHistorico.chirps,seasonYear,lat,ef
    );

    const allYears:number[]=[];for(let y=seasonYear-1;y>=seasonYear-6;y--)allYears.push(y);
    const yearsUsed=ef==="all"?allYears:allYears.filter(y=>ENSO_YEAR[y]===ef);

    const dias=[];
    for(let doy=121;doy<=273;doy++){
      const p=climaPromedio[doy];if(!p)continue;
      const fecha=doyToDate(seasonYear,doy);
      const sw=isoWeek(parseYMD(fecha));
      const e0=p.et0>0.1?p.et0:et0H(p.tmax,p.tmin,p.tavg,doy,lat);
      dias.push({fecha,doy,semana_iso:sw,tmax:+p.tmax.toFixed(1),tmin:+p.tmin.toFixed(1),tavg:+p.tavg.toFixed(1),hum:+p.hum.toFixed(0),lluvia_mm:+p.rain.toFixed(1),et0_mm:+e0.toFixed(2),vpd_hpa:+vpd(p.tavg,p.hum).toFixed(1),gdu:+gdu(p.tmax,p.tmin).toFixed(1),balance_mm:+(p.rain-e0).toFixed(2),dia_seco:p.rain<1,stress34:p.tmax>34,stress32:p.tmax>32,n_years:p.n_years,source:"clima_promedio"});
    }

    return new Response(JSON.stringify({
      ok:true,version:"clima-promedio-export v4",
      nota:"v4: lluvia real Davis usada aunque no haya temperatura. Temp/hum/et0=ERA5 cuando Davis no las tiene.",
      producer:producerKey||null,lat,lon,season_year:seasonYear,as_of:asOf,
      enso_filter:ef,
      enso_meta:{filter:ef,label:ENSO_LABELS[ef],years_candidate:allYears,years_used:yearsUsed,n_years_used:yearsUsed.length,enso_by_year:ENSO_YEAR},
      data_coverage:{
        davis_full_days:davisFullDays,
        davis_rain_only_days:davisRainOnlyDays,
        davis_total_days:davisRainDays,
        nota:"davis_rain_only_days = días con pluviómetro real pero sin sensor de temperatura"
      },
      n_years_at_doy180:climaPromedio[180]?.n_years??0,
      doys_disponibles:Object.keys(climaPromedio).length,
      dias_promedio:dias,
    },null,2),{headers:CORS});
  }catch(e:unknown){
    return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:String(e)}),{status:500,headers:CORS});
  }
});
