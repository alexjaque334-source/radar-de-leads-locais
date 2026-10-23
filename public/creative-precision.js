/* Editor-only positioning helpers. All values are percentages of the canvas. */
(function(root){'use strict';
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function snap({x,y,width=0,height=0,peers=[],threshold=1.5,margin=5}){
  const w=clamp(finite(width),0,100),h=clamp(finite(height),0,100);
  const targetX=[{value:0,kind:'edge'},{value:50,kind:'center'},{value:100,kind:'edge'},{value:margin,kind:'margin'},{value:100-margin,kind:'margin'}];
  const targetY=[{value:0,kind:'edge'},{value:50,kind:'center'},{value:100,kind:'edge'},{value:margin,kind:'margin'},{value:100-margin,kind:'margin'}];
  for(const p of peers){
   if(p.hidden)continue;
   const px=finite(p.x),py=finite(p.y),pw=finite(p.width,45),ph=finite(p.height,0);
   for(const value of [px,px+pw/2,px+pw])targetX.push({value,kind:'peer'});
   for(const value of [py,py+ph/2,py+ph])targetY.push({value,kind:'peer'});
  }
  function axis(pos,size,targets){
   let best=null;
   for(const target of targets)for(const anchor of [0,.5,1]){
    const candidate=target.value-size*anchor,delta=Math.abs(candidate-pos);
    if(delta<=threshold&&(!best||delta<best.delta))best={delta,value:candidate,guide:target.value,kind:target.kind};
   }
   return best?{position:best.value,guide:best.guide,kind:best.kind}:{position:pos,guide:null,kind:null};
  }
  const sx=axis(finite(x),w,targetX),sy=axis(finite(y),h,targetY);
  return {x:clamp(sx.position,0,100-w),y:clamp(sy.position,0,100-h),guideX:sx.guide,guideY:sy.guide,kindX:sx.kind,kindY:sy.kind};
 }
 function clearGuides(stage){stage.querySelectorAll('[data-editor-guide]').forEach(n=>n.remove())}
 function showGuides(stage,result){
  clearGuides(stage);
  for(const [axis,value] of [['x',result.guideX],['y',result.guideY]]){
   if(value===null||!Number.isFinite(value))continue;
   const line=document.createElement('div');
   line.dataset.editorGuide=axis;
   line.className='precision-guide precision-guide-'+axis;
   line.style[axis==='x'?'left':'top']=value+'%';
   line.setAttribute('aria-hidden','true');
   stage.append(line);
  }
 }
 function decorate(stage,{grid=false,rulers=false,margins=false}={}){
  stage.classList.toggle('precision-grid-on',grid);
  stage.classList.toggle('precision-rulers-on',rulers);
  stage.classList.toggle('precision-margins-on',margins);
  let overlay=stage.querySelector('[data-editor-overlay]');
  if(!overlay){overlay=document.createElement('div');overlay.dataset.editorOverlay='';overlay.className='precision-overlay';overlay.setAttribute('aria-hidden','true');stage.append(overlay)}
  overlay.replaceChildren();
  if(margins){const m=document.createElement('div');m.className='precision-margin';overlay.append(m)}
  if(rulers){
   for(const axis of ['x','y']){
    const ruler=document.createElement('div');ruler.className='precision-ruler precision-ruler-'+axis;
    for(let n=0;n<=100;n+=10){const tick=document.createElement('span');tick.textContent=String(n);tick.style[axis==='x'?'left':'top']=n+'%';ruler.append(tick)}
    overlay.append(ruler);
   }
  }
 }
 root.ALEGON_CREATIVE_PRECISION=Object.freeze({snap,clearGuides,showGuides,decorate,clamp});
})(typeof window!=='undefined'?window:globalThis);
