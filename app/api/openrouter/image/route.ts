import { requirePlan } from "@/app/lib/subscriptions";
import { checkRateLimit,requireSameOrigin,readJsonObject } from "@/app/lib/radar-auth";
import { chooseModel,headers,openRouterKey,parseDataImage,privateJson } from "@/app/lib/openrouter";
import { reserveOpenRouter,releaseOpenRouter } from "@/app/lib/openrouter-usage";
export const runtime="edge";export const dynamic="force-dynamic";
export async function POST(request:Request){
 const origin=requireSameOrigin(request);if(origin)return origin;
 const access=await requirePlan(request,"pro");if(access instanceof Response)return access;
 const limited=await checkRateLimit(request,"openrouter-image:"+access.user.id,5);if(limited)return limited;
 const key=openRouterKey();if(!key)return privateJson({error:"OpenRouter ainda não configurada no Worker."},503);
 const input=await readJsonObject(request,3_000_000);if(!input)return privateJson({error:"Requisição inválida ou grande demais."},400);
 const prompt=typeof input.prompt==="string"?input.prompt.trim().slice(0,1200):"";
 if(prompt.length<12)return privateJson({error:"Descreva a imagem ou a mudança desejada em pelo menos 12 caracteres."},400);
 const image=parseDataImage(input.image);
 if(image===null)return privateJson({error:"Imagem inválida ou maior que 2 MB. Use JPEG, PNG ou WebP."},413);
 const selected=chooseModel(access.plan.active,"image",input.model);
 if(!selected)return privateJson({error:"Modelo indisponível para este plano."},403);
 const mode=image?"edit":"generate";
 const reservation=await reserveOpenRouter(access.user.id,access.plan.active,"image");if(!("ok" in reservation))return privateJson({error:reservation.error},reservation.status);
 let submitted=false;
 try{
  const body:Record<string,unknown>={model:selected.id,prompt,n:1,size:"1024x1024",response_format:"b64_json"};
  if(image)body.image=image;
  // OpenRouter native Images API supports generation and edits using the same endpoint.
  const resp=await fetch("https://openrouter.ai/api/v1/images/"+(mode==="edit"?"edits":"generations"),{method:"POST",headers:headers(key),body:JSON.stringify(body),signal:AbortSignal.timeout(55_000)});
  submitted=true;
  const json=await resp.json() as {data?:Array<{b64_json?:string;url?:string}>;error?:{message?:string}};
  if(!resp.ok){
   if([400,401,403,404,422,429].includes(resp.status)){await releaseOpenRouter(access.user.id,"image",reservation.month)}
   return privateJson({error:"Provedor de imagem indisponível ou modelo sem suporte para esta operação.",providerStatus:resp.status},502);
  }
  const result=json.data?.[0];
  if(!result?.b64_json&&!result?.url)return privateJson({error:"Provedor não retornou imagem."},502);
  return privateJson({image:result.b64_json?"data:image/png;base64,"+result.b64_json:result.url,model:selected.id,operation:mode});
 }catch{if(!submitted){/* Timeout may still incur usage: retain reservation. */}return privateJson({error:"Não foi possível concluir a geração. Consulte seu histórico antes de repetir."},502)}
}