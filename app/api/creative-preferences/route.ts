import {requirePlan} from "@/app/lib/subscriptions";
import {db,requireSameOrigin,readJsonObject,checkRateLimit} from "@/app/lib/radar-auth";
export const runtime="edge";export const dynamic="force-dynamic";
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
const color=(s:unknown,fallback:string)=>typeof s==="string"&&/^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():fallback;
function cleanFavorites(v:unknown){if(!Array.isArray(v)||v.length>200)return null;const items=v.filter(x=>typeof x==="string"&&/^[a-z0-9-]{1,60}$/.test(x));return items.length===v.length?[...new Set(items)]:null}
export async function GET(request:Request){
 const auth=await requirePlan(request,"pro");if(auth instanceof Response)return auth;
 const database=db();if(!database)return json({error:"Banco indisponível"},503);
 try{
 const row=await database.prepare("SELECT brand_name,primary_color,secondary_color,favorites_json,updated_at FROM alegon_creative_preferences WHERE user_id=?").bind(auth.user.id).first<{brand_name:string;primary_color:string;secondary_color:string;favorites_json:string;updated_at:string}>();
 if(!row)return json({exists:false,brand:{name:"",primary:"#5b85ff",secondary:"#ffffff"},favorites:[]});
 const favorites=cleanFavorites(JSON.parse(row.favorites_json))||[];
 return json({exists:true,brand:{name:row.brand_name,primary:row.primary_color,secondary:row.secondary_color},favorites,updatedAt:row.updated_at});
 }catch{return json({error:"Preferências ainda indisponíveis. Verifique a migração 0006."},503)}
}
export async function PATCH(request:Request){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const auth=await requirePlan(request,"pro");if(auth instanceof Response)return auth;
 const limit=await checkRateLimit(request,"creative-preferences:"+auth.user.id,50);if(limit)return limit;
 const body=await readJsonObject(request,16_384);if(!body)return json({error:"Dados inválidos"},400);
 const database=db();if(!database)return json({error:"Banco indisponível"},503);
 if(body.brand===undefined&&body.favorites===undefined)return json({error:"Nenhuma alteração enviada"},400);
 let name="",primary="#5b85ff",secondary="#ffffff",favorites:string[]=[];
 if(body.brand!==undefined){if(!body.brand||typeof body.brand!=="object"||Array.isArray(body.brand))return json({error:"Marca inválida"},400);
 const b=body.brand as Record<string,unknown>;
 if(typeof b.name!=="string"||b.name.length>45||typeof b.primary!=="string"||typeof b.secondary!=="string"||!/^#[0-9a-f]{6}$/i.test(b.primary)||!/^#[0-9a-f]{6}$/i.test(b.secondary))return json({error:"Marca inválida"},400);
 name=b.name.trim();primary=color(b.primary,primary);secondary=color(b.secondary,secondary);
 }
 if(body.favorites!==undefined){const cleaned=cleanFavorites(body.favorites);if(!cleaned)return json({error:"Favoritos inválidos"},400);favorites=cleaned}
 try{
 // Separate columns updated independently so a favorites change never erases a brand update.
 await database.prepare("INSERT OR IGNORE INTO alegon_creative_preferences(user_id) VALUES(?)").bind(auth.user.id).run();
 if(body.brand!==undefined)await database.prepare("UPDATE alegon_creative_preferences SET brand_name=?,primary_color=?,secondary_color=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(name,primary,secondary,auth.user.id).run();
 if(body.favorites!==undefined)await database.prepare("UPDATE alegon_creative_preferences SET favorites_json=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(JSON.stringify(favorites),auth.user.id).run();
 return json({saved:true});
 }catch{return json({error:"Não foi possível sincronizar as preferências."},503)}
}
