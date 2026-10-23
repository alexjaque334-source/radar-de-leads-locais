import { requirePlan } from "@/app/lib/subscriptions";
import { modelsFor, openRouterKey, privateJson } from "@/app/lib/openrouter";
export const runtime="edge";export const dynamic="force-dynamic";
export async function GET(request:Request){
 const auth=await requirePlan(request,"essential");if(auth instanceof Response)return auth;
 return privateJson({configured:Boolean(openRouterKey()),plan:auth.plan.active,menu:modelsFor(auth.plan.active,"menu"),image:modelsFor(auth.plan.active,"image"),siteProvider:"deepseek",note:"Sites continuam usando DeepSeek até a migração."});
}