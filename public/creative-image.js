/* ALEGON Creative — imagem: validação, filtros e enquadramento determinísticos. */
(function(root){'use strict';
 const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
 const MODES=['cover','contain'],MASKS=['square','rounded','circle'];
 function normalize(layer){
  const value=layer&&typeof layer==='object'?layer:{};
  return {
   imageFit:MODES.includes(value.imageFit)?value.imageFit:'cover',
   imageMask:MASKS.includes(value.imageMask)?value.imageMask:'square',
   imageX:clamp(value.imageX,0,100,50),
   imageY:clamp(value.imageY,0,100,50),
   imageZoom:clamp(value.imageZoom,100,300,100),
   imageBrightness:clamp(value.imageBrightness,30,200,100),
   imageContrast:clamp(value.imageContrast,30,200,100),
   imageSaturation:clamp(value.imageSaturation,0,250,100),
   imageGrayscale:clamp(value.imageGrayscale,0,100,0),
   imageSepia:clamp(value.imageSepia,0,100,0),
   imageBlur:clamp(value.imageBlur,0,10,0)
  };
 }
 function filter(v){
  const n=normalize(v);
  return 'brightness('+n.imageBrightness+'%) contrast('+n.imageContrast+'%) saturate('+n.imageSaturation+'%) grayscale('+n.imageGrayscale+'%) sepia('+n.imageSepia+'%) blur('+n.imageBlur+'px)';
 }
 function imageStyle(v){
  const n=normalize(v);
  return {width:'100%',height:'100%',objectFit:n.imageFit,objectPosition:n.imageX+'% '+n.imageY+'%',transform:'scale('+(n.imageZoom/100)+')',transformOrigin:'center center',filter:filter(n),display:'block',pointerEvents:'none'};
 }
 function maskStyle(v){
  const n=normalize(v);
  return {overflow:'hidden',borderRadius:n.imageMask==='circle'?'50%':n.imageMask==='rounded'?'16%':'0'};
 }
 // Background cover: CSS custom properties are used by .stage::before, not by extra image layers.
 function cover(input){
  const n=normalize(input);
  return {
   '--cover-zoom':String(n.imageZoom/100),
   '--cover-position':n.imageX+'% '+n.imageY+'%',
   '--cover-filters':'contrast('+n.imageContrast+'%) saturate('+n.imageSaturation+'%) grayscale('+n.imageGrayscale+'%) sepia('+n.imageSepia+'%) blur('+n.imageBlur+'px)'
  };
 }
 root.ALEGON_CREATIVE_IMAGE=Object.freeze({normalize,filter,imageStyle,maskStyle,cover});
})(typeof window!=='undefined'?window:globalThis);
