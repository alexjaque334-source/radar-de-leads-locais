/* ALEGON Creative: deterministic geometry and validation shared by editor and tests. */
(function(root){'use strict';
 const FORMATS=Object.freeze({story:Object.freeze([1080,1920]),post:Object.freeze([1080,1080]),portrait:Object.freeze([1080,1350]),wide:Object.freeze([1920,1080])});
 const KINDS=new Set(['text','rect','ellipse','line','icon','image']);
 const assetRef=/^\/api\/creative-assets\?id=[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 const cloudAsset=value=>typeof value==='string'&&assetRef.test(value)?value:'';
 const clamp=(v,min,max,fallback=min)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
 const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):'#ffffff';
 function dimensions(format){const d=FORMATS[format]||FORMATS.story;return {width:d[0],height:d[1],ratio:d[0]/d[1]}}
 function layer(value){
  const l=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const kind=KINDS.has(l.kind)?l.kind:'text';
  const width=clamp(l.width,15,95,kind==='icon'?22:45);
  return {
    id:typeof l.id==='string'&&/^[a-zA-Z0-9_-]{8,75}$/.test(l.id)?l.id:crypto.randomUUID(),
    text:String(l.text||'').slice(0,220),
    x:clamp(l.x,0,Math.min(94,100-width),10),
    y:clamp(l.y,0,94,20),
    color:color(l.color),size:clamp(l.size,15,75,30),
    weight:['400','700','900'].includes(String(l.weight))?String(l.weight):'700',
    opacity:clamp(l.opacity,20,100,100),kind,width,
    font:['system-ui','Arial','Georgia','Verdana','Trebuchet MS','Courier New'].includes(l.font)?l.font:'system-ui',italic:!!l.italic,shadow:!!l.shadow,spacing:clamp(l.spacing,-2,15,0),rotate:clamp(l.rotate,-180,180,0),flipX:!!l.flipX,flipY:!!l.flipY,locked:!!l.locked,hidden:!!l.hidden,
    icon:typeof l.icon==='string'&&/^[a-z0-9-]{1,60}$/.test(l.icon)?l.icon:'',
    image:kind==='image'&&typeof l.image==='string'?(cloudAsset(l.image)||( /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(l.image)&&l.image.length<500000?l.image:'')) :''
  };
 }
 function align(item,axis,value){
  const l=layer(item);
  if(l.locked)return l;
  if(axis==='x')l.x=clamp(value===50?(100-l.width)/2:value===100?100-l.width:0,0,100-l.width,0);
  if(axis==='y')l.y=value===100?88:value===50?50:0;
  return l;
 }
 function safeProject(p){const raw=p&&typeof p==='object'&&!Array.isArray(p)?p:{};return {...raw,photoSrc:cloudAsset(raw.photoSrc),canvasFormat:FORMATS[raw.canvasFormat]?raw.canvasFormat:'story',layers:Array.isArray(raw.layers)?raw.layers.slice(0,25).map(layer):[]}}
 root.ALEGON_CREATIVE_CORE=Object.freeze({FORMATS,dimensions,clamp,layer,align,safeProject,cloudAsset});
})(typeof window!=='undefined'?window:globalThis);
