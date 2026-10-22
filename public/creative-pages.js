/* ALEGON Criativo | Document model with up to 10 editable pages. */
(function(root){'use strict';
const core=root.ALEGON_CREATIVE_CORE;
if(!core)throw Error('Motor de edição ausente.');
const MAX_PAGES=10;
const FIELDS=['canvasFormat','brand','template','headline','subtitle','cta','accent','align','titleSize','speed','brightness','shade'];
const defaults={canvasFormat:'story',brand:'SUA MARCA',template:'cinematic',headline:'Sua marca em destaque',subtitle:'Sua próxima experiência começa aqui.',cta:'Saiba mais',accent:'#5b85ff',align:'left',titleSize:'35',speed:'9',brightness:'55',shade:'70'};
const uid=()=>crypto.randomUUID();
const cleanName=(value,fallback)=>String(value||fallback).trim().slice(0,65)||fallback;
function page(input,index=0){
 const src=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const normalized=core.safeProject(src);
 const next={id:typeof src.id==='string'&&/^[\da-f-]{36}$/i.test(src.id)?src.id:uid(),name:cleanName(src.name,'Página '+(index+1))};
 for(const field of FIELDS){const v=src[field];next[field]=typeof v==='string'&&v.length<=225?v:defaults[field]}
 next.canvasFormat=normalized.canvasFormat;
 next.photoSrc=normalized.photoSrc;
 next.layers=normalized.layers;
 return next;
}
function documentModel(input){
 const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const source=Array.isArray(raw.pages)&&raw.pages.length?raw.pages.slice(0,MAX_PAGES):[raw];
 const pages=source.map((item,index)=>page(item,index));
 const activePageId=pages.some(p=>p.id===raw.activePageId)?raw.activePageId:pages[0].id;
 return {format:'alegon-cover-v4',projectName:cleanName(raw.projectName,'Minha arte ALEGON').slice(0,100),activePageId,pages};
}
function add(doc){
 const d=documentModel(doc);if(d.pages.length>=MAX_PAGES)return d;
 const p=page({ ...defaults,name:'Página '+(d.pages.length+1)},d.pages.length);
 d.pages.push(p);d.activePageId=p.id;return d;
}
function duplicate(doc,id){
 const d=documentModel(doc);if(d.pages.length>=MAX_PAGES)return d;
 const idx=d.pages.findIndex(p=>p.id===id);if(idx<0)return d;
 const original=d.pages[idx],p=page({...original,id:uid(),name:cleanName(original.name+' (cópia)','Página')},idx+1);
 d.pages.splice(idx+1,0,p);d.activePageId=p.id;return d;
}
function remove(doc,id){
 const d=documentModel(doc);if(d.pages.length<=1)return d;
 const idx=d.pages.findIndex(p=>p.id===id);if(idx<0)return d;
 d.pages.splice(idx,1);
 if(d.activePageId===id)d.activePageId=d.pages[Math.min(idx,d.pages.length-1)].id;
 return d;
}
function move(doc,id,direction){
 const d=documentModel(doc),idx=d.pages.findIndex(p=>p.id===id);
 const next=idx+direction;if(idx<0||next<0||next>=d.pages.length||![-1,1].includes(direction))return d;
 [d.pages[idx],d.pages[next]]=[d.pages[next],d.pages[idx]];
 return d;
}
root.ALEGON_CREATIVE_PAGES=Object.freeze({MAX_PAGES,FIELDS,defaults,page,documentModel,add,duplicate,remove,move});
})(typeof window!=='undefined'?window:globalThis);
