import { checkRateLimit, requireSameOrigin, requireUser, readJsonObject } from "@/app/lib/radar-auth";
export const runtime = "edge";
export const dynamic = "force-dynamic";
const json = (value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
type Tags = Record<string,unknown>;
const clean=(s:unknown)=>typeof s==="string"?s.trim().slice(0,250):"";
const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const digits=(s:string)=>s.replace(/\D/g,"");
const goodPhone=(s:string)=>digits(s).length>=8&&digits(s).length<=15?s:"";
function goodUrl(input:string){if(!input)return "";try{const u=new URL(/^https?:\/\//i.test(input)?input:"https://"+input);if(!["https:","http:"].includes(u.protocol)||u.username||u.password||u.hostname.length<4||!u.hostname.includes("."))return "";return u.href.slice(0,350)}catch{return ""}}
const goodEmail=(s:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s)&&s.length<=120?s:"";
function matchingName(lead:string,tags:Tags){const n=norm(lead);if(n.length<5)return false;const vals=[tags.name,tags["name:pt"],tags.brand,tags.operator].filter((x):x is string=>typeof x==="string");return vals.some(v=>norm(v)===n)}
function distance(a:number,b:number,c:number,d:number){const p=Math.PI/180;const x=(c-a)*p,y=(d-b)*p;const q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 12742000*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
export function selectMatchingOsmElement(value:unknown,name:string,lat:number,lon:number){
  const data=value&&typeof value==="object"?value as {elements?:unknown}:{};if(!Array.isArray(data.elements))return null;
  const choices=data.elements.flatMap(raw=>{
    if(!raw||typeof raw!=="object")return [];
    const e=raw as {tags?:Tags;lat?:unknown;lon?:unknown;center?:{lat?:unknown;lon?:unknown};type?:string;id?:number};
    const tags=e.tags;if(!tags||!matchingName(name,tags))return [];
    const a=Number(e.lat??e.center?.lat),b=Number(e.lon??e.center?.lon);
    if(!Number.isFinite(a)||!Number.isFinite(b))return [];
    const meters=distance(lat,lon,a,b);if(meters>60)return [];
    return [{meters,tags,osmType:e.type,osmId:e.id}];
  }).sort((a,b)=>a.meters-b.meters);
  if(!choices.length)return null;
  // Reject ambiguous identical-name candidates at nearby addresses.
  if(choices.length>1&&choices[1].meters-choices[0].meters<12)return null;
  const match=choices[0],t=match.tags;
  return {
    phone:goodPhone(clean(t["contact:phone"]||t.phone)),
    site:goodUrl(clean(t["contact:website"]||t.website)),
    email:goodEmail(clean(t["contact:email"]||t.email)),
    instagram:goodUrl(clean(t["contact:instagram"]||t.instagram)),
    facebook:goodUrl(clean(t["contact:facebook"]||t.facebook)),
    distanceMeters:Math.round(match.meters),source:"OpenStreetMap",attribution:"© OpenStreetMap contributors",
    osmUrl:match.osmType&&match.osmId?`https://www.openstreetmap.org/${match.osmType}/${match.osmId}`:""
  };
}
export async function POST(request:Request){
  const same=requireSameOrigin(request);if(same)return same;
  const user=await requireUser(request);if(user instanceof Response)return user;
  const input=await readJsonObject(request,2048);if(!input)return json({error:"Dados inválidos"},400);
  const name=clean(input.name),lat=Number(input.lat),lon=Number(input.lon);
  if(name.length<5||name.length>160||!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -35||lat > 6||lon < -75||lon > -30)return json({error:"Informe o nome e as coordenadas do comércio encontrado pela TomTom."},400);
  const limited=await checkRateLimit(request,`osm-enrichment:${user.id}`,12);if(limited)return limited;
  // Fixed-coordinate lookup of already-selected POI only; never run a city/category search.
  const query=`[out:json][timeout:8];(node(around:45,${lat.toFixed(6)},${lon.toFixed(6)})[name];way(around:45,${lat.toFixed(6)},${lon.toFixed(6)})[name];relation(around:45,${lat.toFixed(6)},${lon.toFixed(6)})[name];);out center tags 35;`;
  try{
    const response=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},body:new URLSearchParams({data:query}).toString(),signal:AbortSignal.timeout(10000)});
    if(!response.ok)return json({error:"O serviço público OpenStreetMap está indisponível ou limitando consultas.",code:"OSM_UNAVAILABLE"},503);
    const raw=await response.text();if(raw.length>90000)return json({error:"Resposta OSM acima do limite"},502);
    const match=selectMatchingOsmElement(JSON.parse(raw),name,lat,lon);
    return json({matched:Boolean(match),details:match,source:"OpenStreetMap",temporary:true,attribution:"© OpenStreetMap contributors"});
  }catch{return json({error:"Não foi possível consultar o OSM agora."},503)}
}
