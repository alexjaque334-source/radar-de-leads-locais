import { env } from "cloudflare:workers";
import type { Plan } from "./subscriptions";

type Purpose="menu"|"image";
type ModelInfo={id:string;label:string;minPlan:Plan};
const rank:Record<Plan,number>={essential:0,pro:1,premium:2};
const allowlist:Record<Purpose,ModelInfo[]>={
 menu:[
  {id:"qwen/qwen3.7-flash",label:"Qwen 3.7 Flash · econômico",minPlan:"essential"},
  {id:"openai/gpt-5.4-mini",label:"GPT-5.4 Mini · avançado",minPlan:"pro"},
  {id:"anthropic/claude-sonnet-4.6",label:"Claude Sonnet 4.6 · premium",minPlan:"premium"}
 ],
 image:[
  {id:"bytedance-seed/seedream-5-0-flash",label:"Seedream 5.0 Flash · econômico",minPlan:"pro"},
  {id:"qwen/qwen-image-2.1-turbo",label:"Qwen Image 2.1 Turbo",minPlan:"pro"},
  {id:"qwen/qwen-image-2.1-pro",label:"Qwen Image 2.1 Pro · premium",minPlan:"premium"},
  {id:"openai/gpt-image-2",label:"GPT Image 2 · premium",minPlan:"premium"}
 ]
};
export function modelsFor(plan:Plan,purpose:Purpose){return allowlist[purpose].filter(x=>rank[plan]>=rank[x.minPlan]);}
export function chooseModel(plan:Plan,purpose:Purpose,choice:unknown) {
 const models=modelsFor(plan,purpose);
 const model=typeof choice==="string"&&choice.length>0?models.find(m=>m.id===choice):models[0];
 return model||null;
}
export function openRouterKey():string{
 const bindings=env as typeof env&Record<string,unknown>;
 const key=bindings.OPENROUTER_API_KEY||bindings.RADAR_DE_LEADS_ALEGON||bindings["Radar-de-Leads-ALEGON"];
 return typeof key==="string"?key.trim():"";
}
export const headers=(key:string)=>({
 "Authorization":"Bearer "+key,
 "Content-Type":"application/json",
 "HTTP-Referer":"https://radar-de-leads-locais.leadsbr.workers.dev",
 "X-Title":"ALEGON Radar de Leads"
});
export const privateJson=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store, private"}});
export function parseDataImage(input:unknown,limitBytes=2_000_000){
 if(typeof input!=="string"||!input)return "";
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input);
 if(!match)return null;
 const encoded=match[2],size=Math.floor(encoded.length*3/4)-(encoded.endsWith("==")?2:encoded.endsWith("=")?1:0);
 return size>0&&size<=limitBytes?input:null;
}
