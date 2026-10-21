import { reserveCredits } from "@/app/lib/usage-credits";
import { env } from "cloudflare:workers";
import { checkRateLimit, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";
export const dynamic = "force-dynamic";
export const runtime = "edge";
const respond = (data: unknown, status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store, private"}});
export async function POST(request:Request){
 const originError=requireSameOrigin(request);if(originError)return originError;
 const user=await requireUser(request);if(user instanceof Response)return user;
 const limit=await checkRateLimit(request,`tomtom-geocode:${user.id}`,20);if(limit)return limit;
 if(!env.TOMTOM_API_KEY)return respond({error:"TomTom Geocoding indisponível."},503);
 const input=await readJsonObject(request,2048);if(!input)return respond({error:"Pedido inválido."},400);
 const query=typeof input.query==="string"?input.query.trim():"";
 if(query.length<3||query.length>250)return respond({error:"Informe uma localização válida."},400);
 const url=new URL("https://api.tomtom.com/maps/orbis/places/geocode");
 url.searchParams.set("query",query);url.searchParams.set("countryCodesIso2","BR");url.searchParams.set("maxResults","5");url.searchParams.set("types","area");
 const trackingId=crypto.randomUUID();
 try{
    const credits = await reserveCredits(user.id, "geocode");
    if ("error" in credits) return respond({ error: credits.error, code: "CREDITS_EXHAUSTED" }, credits.status);
  const upstream=await fetch(url,{headers:{"TomTom-Api-Key":env.TOMTOM_API_KEY,"TomTom-Api-Version":"2","Attributes":"results","Accept-Language":"pt-BR","Tracking-Id":trackingId},signal:AbortSignal.timeout(12000)});
  if(!upstream.ok)return respond({error:upstream.status===429?"Limite de consultas TomTom atingido.":"Falha na consulta de geocodificação.",providerStatus:upstream.status,trackingId},upstream.status===429?429:502);
  const payload:unknown=await upstream.json();
  const result=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
  const items=Array.isArray(result.results)?result.results:[];
  const places=items.flatMap(item=>{
    if(!item||typeof item!=="object"||Array.isArray(item))return [];
    const x=item as Record<string,unknown>, position=x.position&&typeof x.position==="object"?x.position as Record<string,unknown>:{}, coordinates=Array.isArray(position.coordinates)?position.coordinates:[];
    const lon=Number(coordinates[0]),lat=Number(coordinates[1]);
    const address=x.address&&typeof x.address==="object"?x.address as Record<string,unknown>:{};
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -35||lat > 6||lon < -75||lon > -30||address.countryCodeIso2!=="BR")return [];
    return [{lat,lon,title:typeof x.title==="string"?x.title.slice(0,200):"",areaType:typeof x.areaType==="string"?x.areaType:""}];
  });
  return respond({places,source:"TomTom Geocoding",temporary:true,trackingId});
 }catch{return respond({error:"TomTom Geocoding não respondeu.",trackingId},502)}
}
