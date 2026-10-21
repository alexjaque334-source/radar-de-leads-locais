import { db } from "./radar-auth";
import { isUnlimitedTestAccount } from "./usage-credits";
import type { Plan } from "./subscriptions";
type Operation="menu"|"image";
const limits:Record<Plan,Record<Operation,number>>={essential:{menu:12,image:0},pro:{menu:35,image:12},premium:{menu:90,image:35}};
export async function reserveOpenRouter(userId:string,plan:Plan,operation:Operation){
 const database=db();if(!database)return {error:"Banco indisponível.",status:503};
 const month=new Date().toISOString().slice(0,7),field=operation==="menu"?"menu_calls":"image_calls";
 const limit=await isUnlimitedTestAccount(userId)?150:limits[plan][operation];
 if(limit<=0)return {error:"Seu plano não permite esta ferramenta de IA.",status:403};
 try{
  const result=await database.prepare(
   "INSERT INTO alegon_openrouter_monthly(user_id,month,"+field+") VALUES(?,?,1) ON CONFLICT(user_id,month) DO UPDATE SET "+field+"="+field+"+1 WHERE "+field+"<?"
  ).bind(userId,month,limit).run();
  if(!result.meta?.changes)return {error:"Limite mensal de "+(operation==="image"?"imagens":"leitura de cardápios")+" atingido.",status:429};
  return {ok:true,month,limit};
 }catch{return {error:"Controle de consumo não inicializado. Não foi realizada chamada paga.",status:503}}
}
export async function releaseOpenRouter(userId:string,operation:Operation,month:string){
 const database=db();if(!database)return;
 const field=operation==="menu"?"menu_calls":"image_calls";
 try{await database.prepare("UPDATE alegon_openrouter_monthly SET "+field+"="+field+"-1 WHERE user_id=? AND month=? AND "+field+">0").bind(userId,month).run()}catch{}
}
