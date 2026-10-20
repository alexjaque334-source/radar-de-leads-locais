import { env } from "cloudflare:workers";
import { checkRateLimit, requireSameOrigin, requireUser } from "@/app/lib/radar-auth";
export const dynamic="force-dynamic";
export const runtime="edge";
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, private"}});
export async function GET(request:Request){const actor=await requireUser(request);if(actor instanceof Response)return actor;return json({configured:Boolean(env.BUCKET),maxPhotos:10,maxBytes:5*1024*1024,requiresAuthorization:true})}
export async function POST(request:Request){const same=requireSameOrigin(request);if(same)return same;const actor=await requireUser(request);if(actor instanceof Response)return actor;const rate=await checkRateLimit(request,`media-upload:${actor.id}`,12);if(rate)return rate;if(!env.BUCKET)return json({error:"Armazenamento R2 ainda não configurado. As fotos continuam disponíveis no editor local."},503);
const type=request.headers.get("content-type")||"";if(!type.startsWith("multipart/form-data"))return json({error:"Envie um formulário com imagem"},415);
if(Number(request.headers.get("content-length")||0)>6*1024*1024)return json({error:"Arquivo excede limite de 5 MB"},413);
const data=await request.formData().catch(()=>null);const file=data?.get("file");const authorized=data?.get("authorized");if(authorized!=="yes")return json({error:"Confirme autorização de uso"},403);if(!(file instanceof File))return json({error:"Foto ausente"},400);
if(file.size>5*1024*1024||file.size<100||!["image/jpeg","image/png","image/webp"].includes(file.type))return json({error:"Imagem inválida ou acima de 5 MB"},413);
const header=new Uint8Array(await file.slice(0,16).arrayBuffer());const valid=file.type==="image/jpeg"?header[0]===0xff&&header[1]===0xd8:file.type==="image/png"?header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71:header[0]===82&&header[1]===73&&header[2]===70&&header[3]===70&&header[8]===87&&header[9]===69&&header[10]===66&&header[11]===80;
if(!valid)return json({error:"Formato de imagem não corresponde ao arquivo"},415);
const key=`business-media/${actor.id}/${crypto.randomUUID()}`;await env.BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{uploadedBy:actor.id,rightsConfirmed:"yes",source:"user-upload"}});
return json({stored:true,key,bytes:file.size,private:true});}
