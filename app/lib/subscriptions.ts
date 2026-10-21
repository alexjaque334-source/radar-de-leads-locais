import { env } from "cloudflare:workers";
import { db, requireUser } from "./radar-auth";
export type Plan = "essential" | "pro" | "premium";
const ranks:Record<Plan,number>={essential:0,pro:1,premium:2};
export const plans:Plan[]=["essential","pro","premium"];
export function validPlan(v:unknown):v is Plan {return typeof v==="string"&&plans.includes(v as Plan);}
export function ownerEmail(email:string){return Boolean(env.SUPERADMIN_EMAIL&&email.toLowerCase()===env.SUPERADMIN_EMAIL.trim().toLowerCase());}
export async function subscription(user:{id:string,email:string}) {
 if(ownerEmail(user.email))return {requested:"premium" as Plan,active:"premium" as Plan,owner:true};
 const database=db();if(!database)throw Error("SUBSCRIPTION_DB_UNAVAILABLE");
 const row=await database.prepare("SELECT requested_plan,active_plan FROM alegon_user_plans WHERE user_id=?").bind(user.id).first<{requested_plan:string;active_plan:string}>();
 if(!row) return {requested:"essential" as Plan,active:"essential" as Plan,owner:false};
 if(!validPlan(row.active_plan)||!validPlan(row.requested_plan))throw Error("INVALID_PLAN");
 return {requested:row.requested_plan,active:row.active_plan,owner:false};
}
export async function requirePlan(request:Request,minimum:Plan){
 const user=await requireUser(request);if(user instanceof Response)return user;
 try {const p=await subscription(user);if(ranks[p.active]<ranks[minimum])return Response.json({error:"Seu plano atual não inclui este recurso.",code:"PLAN_REQUIRED",requiredPlan:minimum},{status:403,headers:{"Cache-Control":"private, no-store"}});return {user,plan:p};}
 catch{return Response.json({error:"Não foi possível verificar seu plano. Tente novamente.",code:"PLAN_UNAVAILABLE"},{status:503});}
}
