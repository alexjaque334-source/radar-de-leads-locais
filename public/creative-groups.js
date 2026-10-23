/* ALEGON Criativo — operações determinísticas de seleção, grupo e layout.
   Sem dependência de DOM: reutilizável nos testes e entre páginas. */
(function(root){'use strict';
 const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 const width=l=>clamp(finite(l.width,45),15,95);
 const selected=(layers,ids)=>layers.filter(l=>ids.includes(l.id));
 const uuid=()=>crypto.randomUUID();
 function group(layers,ids,id=uuid()){
  const wanted=new Set(ids);
  const matching=layers.filter(l=>wanted.has(l.id));
  if(matching.length<2||matching.some(l=>l.locked||l.hidden))return {layers,groupId:null};
  return {layers:layers.map(l=>wanted.has(l.id)?{...l,groupId:id}:l),groupId:id};
 }
 function ungroup(layers,groupId){
  if(!groupId)return layers;
  return layers.map(l=>l.groupId===groupId?{...l,groupId:''}:l);
 }
 function groupIds(layers,id){
  const found=layers.find(l=>l.id===id);
  if(!found)return [];
  return found.groupId?layers.filter(l=>l.groupId===found.groupId).map(l=>l.id):[id];
 }
 function translate(layers,ids,dx,dy){
  const matches=selected(layers,ids);
  if(!matches.length||matches.some(l=>l.locked))return layers;
  const minDx=Math.max(...matches.map(l=>-finite(l.x)));
  const maxDx=Math.min(...matches.map(l=>100-width(l)-finite(l.x)));
  const minDy=Math.max(...matches.map(l=>-finite(l.y)));
  const maxDy=Math.min(...matches.map(l=>94-finite(l.y)));
  const x=clamp(finite(dx),minDx,maxDx);
  const y=clamp(finite(dy),minDy,maxDy);
  const wanted=new Set(ids);
  return layers.map(l=>wanted.has(l.id)?{...l,x:clamp(finite(l.x)+x,0,100-width(l)),y:clamp(finite(l.y)+y,0,94)}:l);
 }
 function align(layers,ids,axis,target){
  const matches=selected(layers,ids);
  if(!matches.length||matches.some(l=>l.locked))return layers;
  const lo=axis==='x'?Math.min(...matches.map(l=>finite(l.x))):Math.min(...matches.map(l=>finite(l.y)));
  const hi=axis==='x'?Math.max(...matches.map(l=>finite(l.x)+width(l))):Math.max(...matches.map(l=>finite(l.y)));
  const center=(lo+hi)/2;
  const offset=target==='start'?-lo:target==='end'?100-hi:50-center;
  return axis==='x'?translate(layers,ids,offset,0):translate(layers,ids,0,target==='end'?94-hi:offset);
 }
 function distribute(layers,ids,axis){
  const matches=selected(layers,ids);
  if(matches.length<3||matches.some(l=>l.locked))return layers;
  const sorted=[...matches].sort((a,b)=>axis==='x'?finite(a.x)-finite(b.x):finite(a.y)-finite(b.y));
  const first=axis==='x'?finite(sorted[0].x):finite(sorted[0].y);
  const last=axis==='x'?finite(sorted.at(-1).x):finite(sorted.at(-1).y);
  const step=(last-first)/(sorted.length-1),changes=new Map(sorted.map((l,i)=>[l.id,axis==='x'?{x:clamp(first+i*step,0,100-width(l))}:{y:clamp(first+i*step,0,94)}]));
  return layers.map(l=>changes.has(l.id)?{...l,...changes.get(l.id)}:l);
 }
 root.ALEGON_CREATIVE_GROUPS=Object.freeze({selected,group,ungroup,groupIds,translate,align,distribute});
})(typeof window!=='undefined'?window:globalThis);
