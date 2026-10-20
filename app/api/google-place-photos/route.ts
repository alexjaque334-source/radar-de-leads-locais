import { env } from "cloudflare:workers";
import { requireUser, requireSameOrigin, readJsonObject, checkRateLimit } from "@/app/lib/radar-auth";
export const runtime = "edge";
export const dynamic = "force-dynamic";
const result=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
 const user=await requireUser(request);if(user instanceof Response)return user;
 return result({configured:Boolean((env as typeof env & {GOOGLE_MAPS_API_KEY?:string}).GOOGLE_MAPS_API_KEY),enabled:false,mode:"explicit-preview-only"});
}
export async function POST(request:Request){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const user=await requireUser(request);if(user instanceof Response)return user;
 const input=await readJsonObject(request,1024);if(!input)return result({error:"Pedido inválido."},400);
 // Two-step confirmation: opt-in per request, never prefetch on page load.
 if(input.confirmPaidRequests!==true)return result({error:"Confirme o consumo de franquia e possíveis cobranças antes da consulta."},400);
 const placeId=typeof input.placeId==="string"?input.placeId.trim():"";
 if(!/^[A-Za-z0-9_-]{12,250}$/.test(placeId))return result({error:"Informe um Google Place ID válido."},400);
 const key=(env as typeof env & {GOOGLE_MAPS_API_KEY?:string}).GOOGLE_MAPS_API_KEY;
 if(!key)return result({error:"Adicione GOOGLE_MAPS_API_KEY aos secrets do Worker, com faturamento e Places API (New) habilitados."},503);
 const rate=await checkRateLimit(request,`google-photos:${user.id}`,5);if(rate)return rate;
 try{
  // Calling 'photos' on Details may trigger the Photos SKU. Never fetch all search results.
  const details=await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,{
   headers:{"X-Goog-Api-Key":key,"X-Goog-FieldMask":"id,photos","Accept":"application/json"},signal:AbortSignal.timeout(12000)});
  if(!details.ok)return result({error:"Não foi possível obter referências de fotos. Verifique a API, o Place ID e as restrições da chave.",providerStatus:details.status},502);
  const data=await details.json() as {photos?:Array<{name?:string;authorAttributions?:Array<{displayName?:string;uri?:string}>}>};
  const photos=[];
  // Max 3 billable photo-media calls per explicit click.
  for(const p of (data.photos||[]).slice(0,3)){
   if(!p.name||!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name))continue;
   const media=await fetch(`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`,{headers:{"X-Goog-Api-Key":key},signal:AbortSignal.timeout(12000)});
   if(!media.ok)continue;
   const payload=await media.json() as {photoUri?:string};
   if(!payload.photoUri?.startsWith("https://"))continue;
   photos.push({url:payload.photoUri,attributions:(p.authorAttributions||[]).map(a=>({name:a.displayName||"",url:a.uri?.startsWith("https://")?a.uri:""}))});
  }
  return result({photos,temporary:true,notice:"Exibição temporária para avaliação na plataforma. Não salve ou publique estas URLs como arquivos permanentes."});
 }catch{return result({error:"Não foi possível consultar Google Places."},502)}
}
