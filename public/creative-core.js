/* ALEGON Creative: deterministic geometry and validation shared by editor and tests. */
(function(root){'use strict';
 const FORMATS=Object.freeze({story:Object.freeze([1080,1920]),post:Object.freeze([1080,1080]),portrait:Object.freeze([1080,1350]),wide:Object.freeze([1920,1080])});
 const KINDS=new Set(['text','rect','ellipse','line','icon','image']);
 const FONTS=Object.freeze(['system-ui','Arial','Georgia','Verdana','Trebuchet MS','Courier New','Impact','Times New Roman','Palatino Linotype','Segoe UI','Tahoma','Arial Black']);
 const EFFECTS=Object.freeze(['none','shadow','outline','neon','soft-glow','extrude']);
 const TEXT_PRESETS=Object.freeze({
  editorial:Object.freeze({font:'Georgia',weight:'700',size:58,italic:false,textEffect:'none',spacing:-1,letterHeight:1.1}),
  impact:Object.freeze({font:'Impact',weight:'900',size:65,italic:false,textEffect:'shadow',spacing:1,letterHeight:1}),
  neon:Object.freeze({font:'Arial',weight:'700',size:46,italic:false,textEffect:'neon',color:'#e6f5ff',outlineColor:'#399eff',spacing:2,letterHeight:1.1}),
  classic:Object.freeze({font:'Palatino Linotype',weight:'700',size:47,italic:true,textEffect:'soft-glow',color:'#fce5b0',spacing:1,letterHeight:1.3}),
  minimal:Object.freeze({font:'Segoe UI',weight:'400',size:38,italic:false,textEffect:'none',spacing:0,letterHeight:1.4})
 });
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
    opacity:clamp(l.opacity,20,100,100),kind,width,groupId:typeof l.groupId==='string'&&/^[a-zA-Z0-9_-]{8,75}$/.test(l.groupId)?l.groupId:'',
    font:FONTS.includes(l.font)?l.font:'system-ui',italic:!!l.italic,shadow:!!l.shadow,spacing:clamp(l.spacing,-2,15,0),textEffect:EFFECTS.includes(l.textEffect)?l.textEffect:(l.shadow?'shadow':'none'),outlineColor:color(l.outlineColor||'#000000'),outlineWidth:clamp(l.outlineWidth,0,5,0),underline:!!l.underline,uppercase:!!l.uppercase,textAlign:['left','center','right'].includes(l.textAlign)?l.textAlign:'left',letterHeight:clamp(l.letterHeight,0.8,2.2,1.15),rotate:clamp(l.rotate,-180,180,0),flipX:!!l.flipX,flipY:!!l.flipY,locked:!!l.locked,hidden:!!l.hidden,
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
 function textStyle(input){
  const l=layer({...input,kind:'text'});
  let shadow=l.shadow?'0 4px 12px #000b':'none';
  let stroke=l.outlineWidth?l.outlineWidth+'px '+l.outlineColor:'0px transparent';
  let fill=l.color;
  if(l.textEffect==='shadow')shadow='3px 5px 3px #000a,0 7px 20px #000a';
  if(l.textEffect==='outline'){stroke=Math.max(1,l.outlineWidth||2)+'px '+l.outlineColor;fill='transparent'}
  if(l.textEffect==='neon')shadow='0 0 5px '+l.color+',0 0 12px '+l.color+',0 0 24px '+l.color;
  if(l.textEffect==='soft-glow')shadow='0 0 10px '+l.color+',0 0 24px '+l.color;
  if(l.textEffect==='extrude')shadow='1px 1px '+l.outlineColor+',2px 2px '+l.outlineColor+',3px 3px '+l.outlineColor+',4px 4px '+l.outlineColor+',6px 9px 16px #0008';
  return {fontFamily:l.font,fontStyle:l.italic?'italic':'normal',fontWeight:l.weight,fontSize:l.size+'px',letterSpacing:l.spacing+'px',lineHeight:String(l.letterHeight),textAlign:l.textAlign,textDecorationLine:l.underline?'underline':'none',textTransform:l.uppercase?'uppercase':'none',textShadow:shadow,WebkitTextStroke:stroke,WebkitTextFillColor:fill,color:l.color};
 }
 function preset(key){const p=TEXT_PRESETS[key];return p?{...p}:null}
 root.ALEGON_CREATIVE_CORE=Object.freeze({FORMATS,FONTS,EFFECTS,TEXT_PRESETS,dimensions,clamp,layer,align,safeProject,cloudAsset,textStyle,preset});
})(typeof window!=='undefined'?window:globalThis);
