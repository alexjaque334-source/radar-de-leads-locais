/* ALEGON | Navegação compartilhada nas áreas autenticadas. Nenhum dado secreto é incluído. */
(()=>{'use strict';
 const loc=location.pathname;
 const publicRoutes=new Set(['/login.html','/plans.html','/']);
 if(publicRoutes.has(loc))return;
 const common=[
  {href:'/radar.html',text:'Radar',symbol:'⌕',key:'radar'},
  {href:'/studio.html',text:'Sites',symbol:'✦',key:'sites'},
  {href:'/menu-studio.html',text:'Cardápios',symbol:'☷',key:'menus',pro:true},
  {href:'/video-studio.html',text:'Criativo',symbol:'◈',key:'creative',pro:true},
  {href:'/library.html',text:'Biblioteca',symbol:'▦',key:'library',pro:true},
  {href:'/account.html',text:'Minha conta',symbol:'◉',key:'account'}
 ];
 const pages={'/radar.html':'Radar de oportunidades','/studio.html':'Sites com IA','/menu-studio.html':'Cardápios digitais','/video-studio.html':'ALEGON Criativo','/library.html':'Biblioteca','/account.html':'Minha conta','/admin.html':'Superadmin'};
 if(!pages[loc])return;
 const style=document.createElement('style');
 style.textContent=`#alegon-app-nav{position:sticky;top:0;z-index:1200;background:#0c1830;color:#ecf3ff;border-bottom:1px solid #2c4163;box-shadow:0 8px 24px #07112125;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
 #alegon-app-nav *{box-sizing:border-box}
 #alegon-app-nav .an-inner{max-width:1650px;margin:auto;display:flex;align-items:center;gap:11px;min-height:68px;padding:10px clamp(12px,2.4vw,34px)}
 #alegon-app-nav .an-back{flex:0 0 auto;border:1px solid #4f6282;border-radius:11px;background:#1d3153;color:#f5f8ff;padding:10px 13px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
 #alegon-app-nav .an-back:hover,#alegon-app-nav .an-link:hover{background:#28446b;color:#fff}
 #alegon-app-nav .an-brand{display:flex;flex-direction:column;min-width:146px}
 #alegon-app-nav .an-brand strong{letter-spacing:.04em;font-size:12px;color:#fff}
 #alegon-app-nav .an-brand small{font-size:10px;color:#9fb7dc}
 #alegon-app-nav .an-links{display:flex;gap:5px;align-items:center;overflow-x:auto;scrollbar-width:thin;scrollbar-color:#526a92 transparent;flex:1;min-width:0;padding:3px}
 #alegon-app-nav .an-link{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:10px 12px;border:1px solid transparent;border-radius:10px;color:#b8cae7;text-decoration:none;font-size:12px;white-space:nowrap;font-weight:650}
 #alegon-app-nav .an-link[aria-current="page"]{background:#345b9d;color:white;border-color:#5177b1}
 #alegon-app-nav .an-link:focus-visible,#alegon-app-nav .an-back:focus-visible{outline:2px solid #95caff;outline-offset:3px}
 body.alegon-hide-old-header>header{display:none}
 @media(max-width:960px){#alegon-app-nav .an-inner{flex-wrap:wrap;gap:7px;padding:9px 12px}#alegon-app-nav .an-brand{flex:1}#alegon-app-nav .an-links{flex-basis:100%;order:3;padding:2px 0 0}}
 @media(max-width:540px){#alegon-app-nav .an-brand strong{font-size:11px}#alegon-app-nav .an-brand small{font-size:9px}#alegon-app-nav .an-back{padding:9px 12px}}
 `;
 document.head.append(style);
 if(['/menu-studio.html','/video-studio.html','/library.html'].includes(loc))document.body.classList.add('alegon-hide-old-header');
 const el=document.createElement('nav');el.id='alegon-app-nav';el.setAttribute('aria-label','Navegação principal do Radar de Leads');
 const wrap=document.createElement('div');wrap.className='an-inner';el.append(wrap);
 const back=document.createElement('button');back.type='button';back.className='an-back';back.textContent='← Voltar';back.addEventListener('click',()=>{
  const ref=document.referrer;
  try{const url=new URL(ref);if(url.origin===location.origin&&url.pathname!==loc&&url.pathname!=='/login.html'&&history.length>1){history.back();return}}catch{}
  location.assign(loc==='/radar.html'?'/plans.html':'/radar.html');
 });
 wrap.append(back);
 const brand=document.createElement('div');brand.className='an-brand';const title=document.createElement('strong');title.textContent='ALEGON · RADAR';const current=document.createElement('small');current.textContent=pages[loc];brand.append(title,current);wrap.append(brand);
 const links=document.createElement('div');links.className='an-links';wrap.append(links);
 function draw(user){links.replaceChildren();const isPro=['pro','premium'].includes(user.plan)||user.user?.isOwner;const options=common.filter(item=>!item.pro||isPro);
  if(user.user?.isOwner)options.push({href:'/admin.html',text:'Admin',symbol:'⚙',key:'admin'});
  for(const item of options){const a=document.createElement('a');a.href=item.href;a.className='an-link';a.textContent=item.symbol+' '+item.text;if(item.href===loc)a.setAttribute('aria-current','page');links.append(a)}
 }
 fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data?.authenticated){draw(data);document.body.prepend(el)}}).catch(()=>{});
})();