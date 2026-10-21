import { db,sha256 } from "./radar-auth";
export const MAX_ACCOUNT_REQUESTS_MONTH=12;
export const MAX_ACCOUNT_TOKENS_MONTH=90000;
export const MAX_REFINEMENTS=3;
export function canonicalLeadKey(brief:{name:string;address:string;city:string;state:string},placeId:string){
  if(/^[a-zA-Z0-9_-]{8,160}$/.test(placeId))return "tomtom:"+placeId;
  const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  return "manual:"+[brief.name,brief.address,brief.city,brief.state].map(norm).join("|").slice(0,500);
}
export async function reserveSiteRequest(userId:string,projectId:string,leadKey:string,mode:"generate"|"refine",reservedTokens:number){
 const database=db();if(!database)return {error:"Banco indisponível para controlar créditos.",status:503};
 const month=new Date().toISOString().slice(0,7);
 if(!Number.isSafeInteger(reservedTokens)||reservedTokens<7000||reservedTokens>MAX_ACCOUNT_TOKENS_MONTH)return {error:"Este pedido excede o orçamento seguro de tokens. Reduza o HTML ou remova a imagem.",status:413};
 // Reserve budget BEFORE provider call. Failed provider requests still consume a slot: they may incur costs.
 try{
  const existing=await database.prepare("SELECT project_id,generations,refinements FROM alegon_site_ai_usage WHERE user_id=? AND lead_key=?").bind(userId,leadKey).first<{project_id:string;generations:number;refinements:number}>();
  if(mode==="generate"&&existing?.generations)return {error:"Este estabelecimento já usou sua geração inicial. Faça até três edições com IA ou edite manualmente.",status:429};
  if(mode==="refine"&&(!existing||existing.project_id!==projectId||existing.generations!==1))return {error:"Projeto não encontrado para esta conta e estabelecimento.",status:403};
  if(mode==="refine"&&existing.refinements>=MAX_REFINEMENTS)return {error:"As três edições com IA deste site terminaram. A edição manual continua liberada.",status:429};
  const current=await database.prepare("SELECT requests,tokens FROM alegon_site_ai_monthly WHERE user_id=? AND month=?").bind(userId,month).first<{requests:number;tokens:number}>();
  if((current?.requests??0)>=MAX_ACCOUNT_REQUESTS_MONTH||(current?.tokens??0)+reservedTokens>MAX_ACCOUNT_TOKENS_MONTH)return {error:"Limite mensal de IA atingido para esta conta. Você pode continuar editando manualmente.",status:429};
  // Atomic conditional claim prevents concurrent requests for same lead from both succeeding.
  const id=crypto.randomUUID();
  const insert=mode==="generate"
    ?await database.prepare("INSERT INTO alegon_site_ai_usage(user_id,lead_key,project_id,generations,refinements) VALUES(?,?,?,1,0) ON CONFLICT(user_id,lead_key) DO NOTHING").bind(userId,leadKey,projectId).run()
    :await database.prepare("UPDATE alegon_site_ai_usage SET refinements=refinements+1,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND lead_key=? AND project_id=? AND generations=1 AND refinements<3").bind(userId,leadKey,projectId).run();
  if(!insert.meta?.changes)return {error:"Limite por estabelecimento atingido ou operação simultânea detectada.",status:429};
  const global=await database.prepare("INSERT INTO alegon_site_ai_monthly(user_id,month,requests,generations,tokens) VALUES(?,?,1,?,?) ON CONFLICT(user_id,month) DO UPDATE SET requests=requests+1,generations=generations+excluded.generations,tokens=tokens+excluded.tokens WHERE requests<? AND tokens+excluded.tokens<=?").bind(userId,month,mode==="generate"?1:0,reservedTokens,MAX_ACCOUNT_REQUESTS_MONTH,MAX_ACCOUNT_TOKENS_MONTH).run();
  if(!global.meta?.changes)return {error:"Limite mensal atingido; a solicitação não foi enviada à IA.",status:429};
  return {ok:true,projectId,leadKey,month,reservedTokens,refinements:mode==="refine"?(existing?.refinements??0)+1:0,requestId:id};
 }catch{return {error:"Controle de créditos indisponível. A IA não foi acionada.",status:503}}
}
export async function recordTokenUsage(userId:string,leadKey:string,month:string,inputTokens:number|undefined,outputTokens:number|undefined,reservedTokens:number){
 // Keep the conservative pre-charge if the provider does not report usage.
 if(!Number.isSafeInteger(inputTokens)||!Number.isSafeInteger(outputTokens)||inputTokens<0||outputTokens<0)return;
 const actual=inputTokens+outputTokens;
 if(actual<0||actual>500000)return;
 const database=db();if(!database)return;
 await database.batch([
 database.prepare("UPDATE alegon_site_ai_usage SET consumed_tokens=consumed_tokens+?,input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE user_id=? AND lead_key=?").bind(actual,inputTokens,outputTokens,userId,leadKey),
 database.prepare("UPDATE alegon_site_ai_monthly SET tokens=MAX(0,tokens+?),input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE user_id=? AND month=?").bind(actual-reservedTokens,inputTokens,outputTokens,userId,month)
 ]);
}
export async function quotaStatus(userId:string,projectId:string,leadKey:string){
 const database=db();if(!database)return null;
 try{
 const month=new Date().toISOString().slice(0,7);
 const item=await database.prepare("SELECT generations,refinements,project_id,consumed_tokens FROM alegon_site_ai_usage WHERE user_id=? AND lead_key=?").bind(userId,leadKey).first<{generations:number;refinements:number;project_id:string;consumed_tokens:number}>();
 const total=await database.prepare("SELECT requests,tokens FROM alegon_site_ai_monthly WHERE user_id=? AND month=?").bind(userId,month).first<{requests:number;tokens:number}>();
 return {hasGenerated:!!item?.generations,editsRemaining:Math.max(0,3-(item?.refinements??0)),sameProject:!item||item.project_id===projectId,monthlyRequestsRemaining:Math.max(0,MAX_ACCOUNT_REQUESTS_MONTH-(total?.requests??0)),monthlyTokensRemaining:Math.max(0,MAX_ACCOUNT_TOKENS_MONTH-(total?.tokens??0))};
 }catch{return null}
}