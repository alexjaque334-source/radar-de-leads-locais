import { env } from "cloudflare:workers";
import { requirePlan } from "@/app/lib/subscriptions";
import { checkRateLimit, requireSameOrigin } from "@/app/lib/radar-auth";
export const runtime="edge";export const dynamic="force-dynamic";
const MAX_BYTES=5*1024*1024;
const idValid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private,no-store"}});
function safeType(file:File,head:Uint8Array){
 if(file.type==="image/jpeg"&&head[0]===0xff&&head[1]===0xd8)return file.type;
 if(file.type==="image/png"&&head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71)return file.type;
 if(file.type==="image/webp"&&String.fromCharCode(...head.slice(0,4))==="RIFF"&&String.fromCharCode(...head.slice(8,12))==="WEBP")return file.type;
 return null;
}
export async function GET(request:Request){
 const auth=await requirePlan(request,"pro");if(auth instanceof Response)return auth;
 if(!env.BUCKET)return reply({error:"Armazenamento de imagens indisponível."},503);
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!idValid(id))return reply({error:"Imagem não encontrada."},404);
 const object=await env.BUCKET.get("creative-assets/"+auth.user.id+"/"+id);
 if(!object)return reply({error:"Imagem não encontrada."},404);
 const contentType=object.httpMetadata?.contentType||"application/octet-stream";
 if(!["image/png","image/jpeg","image/webp"].includes(contentType))return reply({error:"Formato não permitido."},415);
 return new Response(object.body,{headers:{"Content-Type":contentType,"Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
}
export async function POST(request:Request){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const auth=await requirePlan(request,"pro");if(auth instanceof Response)return auth;
 if(!env.BUCKET)return reply({error:"Biblioteca de imagens indisponível. Você ainda pode trabalhar com arquivos locais."},503);
 const limited=await checkRateLimit(request,"creative-assets:"+auth.user.id,30);if(limited)return limited;
 if(Number(request.headers.get("content-length")||"0")>MAX_BYTES+250_000)return reply({error:"Imagem excede 5 MB."},413);
 if(!(request.headers.get("content-type")||"").startsWith("multipart/form-data"))return reply({error:"Envie uma imagem."},415);
 const form=await request.formData().catch(()=>null),file=form?.get("image");
 if(!(file instanceof File)||file.size<50||file.size>MAX_BYTES)return reply({error:"Imagem inválida ou maior que 5 MB."},413);
 if(form?.get("authorized")!=="yes")return reply({error:"Confirme a autorização para utilizar a imagem."},403);
 const signature=new Uint8Array(await file.slice(0,12).arrayBuffer()),contentType=safeType(file,signature);
 if(!contentType)return reply({error:"Utilize JPEG, PNG ou WebP válidos."},415);
 const id=crypto.randomUUID(),key="creative-assets/"+auth.user.id+"/"+id;
 try{await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType},customMetadata:{userId:auth.user.id,rightsConfirmed:"yes"}});
 return reply({id,src:"/api/creative-assets?id="+id,bytes:file.size,stored:true},201)}
 catch{return reply({error:"Não foi possível armazenar a imagem."},503)}
}
