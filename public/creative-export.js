/* ALEGON Criativo: export the same DOM scene used by the editor.
   HTML retains motion; PNG freezes that scene at its resting state.
   No external vendor, remote font or CDN dependency. */
(function(root){'use strict';
 const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const BLOB_LIMIT=7*1024*1024;
 const formats={story:[1080,1920],post:[1080,1080],portrait:[1080,1350],wide:[1920,1080]};
 const XHTML='http://www.w3.org/1999/xhtml';
 const SVG_NS='http://www.w3.org/2000/svg';
 const dataImagePattern=/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
 function canvasSize(format){const d=formats[format]||formats.story;return {width:d[0],height:d[1]}}
 function safeFilename(value){return (String(value||'alegon-criativo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,55)||'arte').toLowerCase()}
 async function cssText(){
  const inline=[...document.querySelectorAll('head style')].map(e=>e.textContent||'').join('\n');
  const r=await fetch('/creative-editor-v3.css',{cache:'force-cache',credentials:'same-origin'});
  if(!r.ok)throw Error('Não foi possível carregar o estilo necessário para exportar.');
  const css=await r.text();
  return inline+'\n'+css;
 }
 function readAsData(blob){return new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(String(f.result||''));f.onerror=()=>no(Error('Falha ao incorporar uma imagem.'));f.readAsDataURL(blob)})}
 async function embedImage(source){
  if(!source)return '';
  if(dataImagePattern.test(source))return source;
  const ownedAsset=/^\/api\/creative-assets\?id=[0-9a-f-]{36}$/i.test(source);if(!ownedAsset&&!source.startsWith('blob:')&&!source.startsWith('https://')&&!source.startsWith('http://'))throw Error('O formato da imagem não é compatível com a exportação.');
  // Blobs are already local. Cross-origin downloads only succeed when authorized by CORS.
  let response;try{response=await fetch(source,{mode:'cors',credentials:ownedAsset?'same-origin':'omit'})}catch{throw Error('A foto não permite incorporação. Envie-a como arquivo próprio antes de exportar.')}
  if(!response.ok)throw Error('A foto não pôde ser carregada para exportação.');
  const data=await response.blob();
  if(!['image/png','image/jpeg','image/webp'].includes(data.type))throw Error('O arquivo não é uma imagem PNG, JPG ou WebP válida.');
  if(data.size>BLOB_LIMIT)throw Error('A imagem é maior que o limite de exportação. Comprima-a antes de tentar novamente.');
  return readAsData(data);
 }
 async function build(stage,photoSource){
  if(!stage||stage.id!=='stage')throw Error('A área de edição não foi encontrada.');
  const stageWidth=stage.offsetWidth,stageHeight=stage.offsetHeight;
  if(stageWidth<40||stageHeight<40)throw Error('A área de edição não tem tamanho válido.');
  const clone=stage.cloneNode(true);
  // Rulers, snap lines and margin/grid aids belong to the editor, not the export.
  clone.querySelectorAll('[data-editor-overlay],[data-editor-guide]').forEach(node=>node.remove());
  clone.classList.remove('precision-grid-on','precision-rulers-on','precision-margins-on');
  clone.querySelectorAll('.resize-handle').forEach(node=>node.remove());
  clone.querySelectorAll('.custom-layer').forEach(node=>{
    node.classList.remove('selected');
    node.removeAttribute('tabindex');
    node.removeAttribute('aria-label');
  });
  clone.classList.remove('snap-center','snap-middle','show-grid');
  clone.style.removeProperty('transform'); // The zoom slider only affects editor viewing.
  clone.style.width=stageWidth+'px';
  clone.style.height=stageHeight+'px';
  clone.style.maxHeight='none';
  clone.style.margin='0';
  clone.style.boxShadow='none';
  clone.style.borderRadius='0';
  if(photoSource){
    const photo=await embedImage(photoSource);
    if(!dataImagePattern.test(photo))throw Error('A foto não foi incorporada à exportação.');
    clone.style.setProperty('--bg','url("'+photo+'")');
  }else{
    const bg=clone.style.getPropertyValue('--bg');
    if(/url\s*\(/i.test(bg))throw Error('Há uma imagem de capa que não pôde ser incorporada. Carregue-a novamente.');
  }
  // Preserve embedded user images but reject non-data URLs to avoid broken offline exports.
  for(const img of clone.querySelectorAll('img')){
    const source=img.getAttribute('src')||'';
    if(source.startsWith('data:image/svg+xml'))continue; // our own catalog icons
    if(!dataImagePattern.test(source)){
      if(!source)throw Error('Um elemento de imagem está vazio.');
      img.src=await embedImage(source);
    }
  }
  return {clone,css:await cssText(),width:stageWidth,height:stageHeight};
 }
 function freezeCss(){return '*,*::before,*::after{animation:none!important;transition:none!important} .custom-layer{outline:none!important} .resize-handle{display:none!important}'}
 function makeXhtmlScene(snapshot,freeze){
  const holder=document.createElementNS(XHTML,'div');holder.setAttribute('xmlns',XHTML);
  holder.setAttribute('style','width:'+snapshot.width+'px;height:'+snapshot.height+'px;overflow:hidden;position:relative');
  const style=document.createElementNS(XHTML,'style');
  style.textContent=snapshot.css+'\n'+(freeze?freezeCss():'');
  holder.append(style);
  holder.append(snapshot.clone);
  return holder;
 }
 function svgMarkup(snapshot){
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('xmlns',SVG_NS);
  svg.setAttribute('width',String(snapshot.width));
  svg.setAttribute('height',String(snapshot.height));
  svg.setAttribute('viewBox','0 0 '+snapshot.width+' '+snapshot.height);
  const fo=document.createElementNS(SVG_NS,'foreignObject');
  fo.setAttribute('width','100%');fo.setAttribute('height','100%');
  fo.append(makeXhtmlScene(snapshot,true));svg.append(fo);
  return new XMLSerializer().serializeToString(svg);
 }
 function exportOptions(options={}){
  const scale=[.5,1,2].includes(Number(options.scale))?Number(options.scale):1;
  const quality=Math.min(.95,Math.max(.5,Number.isFinite(Number(options.quality))?Number(options.quality):.88));
  return {scale,quality,transparent:options.transparent===true};
 }
 async function rasterize(stage,format,photoSource,options={}){
  const settings=exportOptions(options);
  const scene=await build(stage,photoSource);
  if(settings.transparent){
   scene.clone.classList.add('export-transparent');
   scene.clone.style.setProperty('--bg','none');
   scene.clone.style.background='transparent';
   scene.css+='\n#stage.export-transparent,#stage.export-transparent::before,#stage.export-transparent::after{background:none!important;box-shadow:none!important}';
  }
  const size=canvasSize(format),width=Math.round(size.width*settings.scale),height=Math.round(size.height*settings.scale);
  if(width*height>9000000)throw Error('A resolução excede o limite de segurança para exportação.');
  const svg=svgMarkup(scene);
  const src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  const image=new Image();
  await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('Este navegador não conseguiu renderizar a imagem. Tente no Chrome ou Edge.'));image.src=src});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Seu navegador não suporta exportação PNG.');
  // JPEG must have an opaque background; transparent WebP/PNG retain alpha.
  if(options.mime==='image/jpeg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height)}
  ctx.drawImage(image,0,0,width,height);
  return {canvas,width,height,settings};
 }
 async function raster(stage,format,project,photoSource,mime='image/png',options={}){
  const supported={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  if(!supported[mime])throw Error('Formato de imagem indisponível.');
  const {canvas,width,height,settings}=await rasterize(stage,format,photoSource,{...options,mime});
  const blob=await new Promise((ok,no)=>{try{canvas.toBlob(b=>b?ok(b):no(Error('Falha ao criar a imagem.')),mime,settings.quality)}catch{no(Error('O navegador bloqueou esta exportação.'))}});
  if(!blob||!blob.size||blob.type!==mime)throw Error('O navegador não suporta este formato de saída.');
  return {blob,name:safeFilename(project)+'.'+supported[mime],width,height};
 }
 function png(stage,format,project,photoSource,options){return raster(stage,format,project,photoSource,'image/png',options)}
 function jpeg(stage,format,project,photoSource,options){return raster(stage,format,project,photoSource,'image/jpeg',{...options,transparent:false})}
 function webp(stage,format,project,photoSource,options){return raster(stage,format,project,photoSource,'image/webp',options)}
 async function svg(stage,format,project,photoSource,options={}){
  const settings=exportOptions(options),scene=await build(stage,photoSource);
  if(settings.transparent){
   scene.clone.classList.add('export-transparent');
   scene.clone.style.setProperty('--bg','none');
   scene.clone.style.background='transparent';
   scene.css+='\n#stage.export-transparent,#stage.export-transparent::before,#stage.export-transparent::after{background:none!important}';
  }
  const {width,height}=canvasSize(format);
  const markup=svgMarkup(scene).replace(/<svg /,'<svg role="img" aria-label="Arte ALEGON" ')
   .replace(/(<svg[^>]*?)width="[^"]+"/,'$1width="'+width+'"')
   .replace(/(<svg[^>]*?)height="[^"]+"/,'$1height="'+height+'"');
  return {blob:new Blob([markup],{type:'image/svg+xml;charset=utf-8'}),name:safeFilename(project)+'.svg',width,height};
 }
 function pdfFromJpeg(jpegBytes,width,height){
  const encoder=new TextEncoder(),parts=[],offsets=[0];let total=0;
  const add=chunk=>{const bytes=typeof chunk==='string'?encoder.encode(chunk):chunk;parts.push(bytes);total+=bytes.length};
  const object=(id,content)=>{offsets[id]=total;add(id+' 0 obj\n'+content+'\nendobj\n')};
  add('%PDF-1.4\n');
  const pageW=+(width*.75).toFixed(2),pageH=+(height*.75).toFixed(2);
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageW+' '+pageH+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=total;add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpegBytes.length+' >>\nstream\n');add(jpegBytes);add('\nendstream\nendobj\n');
  const instructions='q\n'+pageW+' 0 0 '+pageH+' 0 0 cm\n/Im0 Do\nQ\n';
  object(5,'<< /Length '+encoder.encode(instructions).length+' >>\nstream\n'+instructions+'endstream');
  const xref=total;add('xref\n0 6\n0000000000 65535 f \n');
  for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  return new Blob(parts,{type:'application/pdf'});
 }
 async function pdf(stage,format,project,photoSource,options={}){
  const rasterResult=await jpeg(stage,format,project,photoSource,options);
  const bytes=new Uint8Array(await rasterResult.blob.arrayBuffer());
  return {blob:pdfFromJpeg(bytes,rasterResult.width,rasterResult.height),name:safeFilename(project)+'.pdf',width:rasterResult.width,height:rasterResult.height};
 }
 async function html(stage,format,project,photoSource){
  const scene=await build(stage,photoSource);
  const css=scene.css.replace(/<\/style/gi,'<\\/style');
  const content='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(project||'Arte ALEGON')+'</title><style>'+css+'\nhtml,body{margin:0;min-height:100%;background:#0b1221;}body{display:grid;place-items:center;min-height:100vh;padding:12px;box-sizing:border-box;}#stage{transform:none!important;box-shadow:none!important;margin:auto!important;max-height:none!important;} .custom-layer{outline:none!important;cursor:default!important;}</style></head><body class="creative-v3"><div style="max-width:100%;overflow:auto">'+scene.clone.outerHTML+'</div></body></html>';
  return {blob:new Blob([content],{type:'text/html;charset=utf-8'}),name:safeFilename(project)+'.html',size:content.length};
 }
 root.ALEGON_CREATIVE_EXPORT=Object.freeze({canvasSize,safeFilename,exportOptions,pdfFromJpeg,png,jpeg,webp,svg,pdf,html});
})(typeof window!=='undefined'?window:globalThis);
