import {requirePlan} from "@/app/lib/subscriptions";
import { env } from "cloudflare:workers";
import { currentUser,db,requireUser,requireSameOrigin,readJsonObject,checkRateLimit } from "@/app/lib/radar-auth";
export const runtime="edge";export const dynamic="force-dynamic";
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
const isAdmin=(email:string)=>Boolean(env.SUPERADMIN_EMAIL&&email.toLowerCase()===env.SUPERADMIN_EMAIL.trim().toLowerCase());
const kinds=["site","menu","ad"];
const creativeUrl=/^\/api\/creative-assets\?id=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i;
async function validateCreativeAssets(payload:unknown,userId:string){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
 const data=payload as Record<string,unknown>,refs:string[]=[];
 const pages=data.format==="alegon-cover-v4" ? data.pages : [data];
 if(!Array.isArray(pages)||pages.length<1||pages.length>10)return false;
 if(data.format==="alegon-cover-v4"){
  if(typeof data.activePageId!=="string"||!pages.some(p=>p&&typeof p==="object"&&(p as Record<string,unknown>).id===data.activePageId))return false;
 }
 let count=0;
 for(const value of pages){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const page=value as Record<string,unknown>;
  if(page.photoSrc!==undefined&&page.photoSrc!==""){if(typeof page.photoSrc!=="string"||!creativeUrl.test(page.photoSrc))return false;refs.push(page.photoSrc)}
  if(page.layers!==undefined&&!Array.isArray(page.layers))return false;
  if(Array.isArray(page.layers)){if(page.layers.length>25)return false;count+=page.layers.length;
   for(const item of page.layers){if(!item||typeof item!=="object"||Array.isArray(item))return false;const layer=item as Record<string,unknown>;
    if(layer.kind==="image"&&layer.image){if(typeof layer.image!=="string"||!creativeUrl.test(layer.image))return false;refs.push(layer.image)}
   }
  }
 }
 if(count>250||refs.length>260)return false;
 if(!refs.length)return true;
 if(!env.BUCKET)return false;
 for(const url of new Set(refs)){const id=creativeUrl.exec(url)?.[1];if(!id)return false;const obj=await env.BUCKET.head("creative-assets/"+userId+"/"+id);if(!obj)return false}
 return true;
}

export async function GET(request:Request){const access=await requirePlan(request,"pro");if(access instanceof Response)return access;const user=access.user;const database=db();if(!database)return json({error:"Banco indisponível"},503);
const u=new URL(request.url);const kind=u.searchParams.get("type");const own=u.searchParams.get("mine")==="1";
try{if(own){const rows=await database.prepare("SELECT id,title,type,payload,updated_at FROM alegon_library_projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(user.id).all();return json({projects:rows.results||[]})}const rows=await database.prepare("SELECT id,title,type,description,payload,updated_at FROM alegon_library_templates WHERE published=1 AND (? IS NULL OR type=?) ORDER BY updated_at DESC LIMIT 100").bind(kinds.includes(kind||"")?kind:null,kinds.includes(kind||"")?kind:null).all();return json({templates:rows.results||[],admin:isAdmin(user.email)})}catch{return json({error:"Biblioteca ainda não inicializada. Aplique a migração 0001 antes de usar."},503)}}
export async function POST(request:Request){const origin=requireSameOrigin(request);if(origin)return origin;const access=await requirePlan(request,"pro");if(access instanceof Response)return access;const user=access.user;const limit=await checkRateLimit(request,"library:"+user.id,40);if(limit)return limit;const database=db();if(!database)return json({error:"Banco indisponível"},503);const body=await readJsonObject(request,120_000);if(!body)return json({error:"Dados inválidos"},400);
const type=typeof body.type==="string"?body.type:"",title=typeof body.title==="string"?body.title.trim().slice(0,100):"",description=typeof body.description==="string"?body.description.trim().slice(0,600):"";if(!kinds.includes(type)||!title)return json({error:"Tipo ou título inválido"},400);
const payload=body.payload;if(!payload||typeof payload!=="object"||Array.isArray(payload))return json({error:"Projeto precisa de dados editáveis estruturados"},400);if(type==='ad'&&!(await validateCreativeAssets(payload,user.id)))return json({error:'Imagens inválidas ou não pertencem à sua conta.'},403);const data=JSON.stringify(payload);if(data.length>100_000)return json({error:"Projeto muito grande"},413);
const global=body.global===true;if(global&&!isAdmin(user.email))return json({error:"Somente superadmin publica modelos globais"},403);
const templateId=typeof body.templateId==="string"?body.templateId:"";
if(templateId&&!/^[0-9a-f]{8}-[0-9a-f-]{27,28}$/i.test(templateId))return json({error:"Modelo inválido"},400);
if(!global&&templateId){const original=await database.prepare("SELECT id,type FROM alegon_library_templates WHERE id=? AND published=1 LIMIT 1").bind(templateId).first<{id:string;type:string}>();if(!original||original.type!==type)return json({error:"Modelo não disponível para cópia"},404)}

try{const id=crypto.randomUUID();if(global){await database.prepare("INSERT INTO alegon_library_templates(id,type,title,description,payload,published,author_id) VALUES(?,?,?,?,?,1,?)").bind(id,type,title,description,data,user.id).run()}else{await database.prepare("INSERT INTO alegon_library_projects(id,user_id,template_id,title,type,payload) VALUES(?,?,?,?,?,?)").bind(id,user.id,templateId||null,title,type,data).run()}return json({id,global},201)}catch{return json({error:"Não foi possível salvar. Confira a migração do banco."},503)}}
export async function PATCH(request:Request){const same=requireSameOrigin(request);if(same)return same;const access=await requirePlan(request,"pro");if(access instanceof Response)return access;const user=access.user;const body=await readJsonObject(request,120_000);if(!body)return json({error:"Requisição inválida"},400);const id=typeof body.id==="string"?body.id:"";if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:"Projeto inválido"},400);const database=db();if(!database)return json({error:"Banco indisponível"},503);try{const row=await database.prepare("SELECT id FROM alegon_library_projects WHERE id=? AND user_id=? LIMIT 1").bind(id,user.id).first();if(!row)return json({error:"Projeto não pertence à sua conta"},404);const title=typeof body.title==="string"?body.title.trim().slice(0,100):"";if(!title||!body.payload||typeof body.payload!=="object"||Array.isArray(body.payload))return json({error:"Título ou dados inválidos"},400);if(!(await validateCreativeAssets(body.payload,user.id)))return json({error:'Imagens inválidas ou não pertencem à sua conta.'},403);const payload=JSON.stringify(body.payload);if(payload.length>100000)return json({error:"Projeto excede o limite"},413);await database.prepare("UPDATE alegon_library_projects SET title=?,payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(title,payload,id,user.id).run();return json({saved:true,id})}catch{return json({error:"Falha ao atualizar projeto"},503)}}
export async function DELETE(request:Request){const origin=requireSameOrigin(request);if(origin)return origin;const access=await requirePlan(request,"pro");if(access instanceof Response)return access;const user=access.user;if(!isAdmin(user.email))return json({error:"Somente o superadmin pode remover modelos globais"},403);const body=await readJsonObject(request,2048);const id=typeof body?.id==="string"?body.id:"";if(!id)return json({error:"Identificador inválido"},400);try{await db()!.prepare("UPDATE alegon_library_templates SET published=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return json({unpublished:true})}catch{return json({error:"Biblioteca indisponível"},503)}}