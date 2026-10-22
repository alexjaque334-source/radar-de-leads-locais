/* Modelos originais ALEGON, editáveis e sem recursos externos. */
(function(root){'use strict';
const templates=[
 ['promo','Promoção irresistível','Marketing','post','#ff5a36','OFERTA ESPECIAL','Seu produto favorito com condições imperdíveis','Garanta já','impact'],
 ['launch','Grande inauguração','Marketing','story','#f9ba45','ESTAMOS CHEGANDO','Prepare-se para uma nova experiência','Conheça','neon'],
 ['barber','Barbearia premium','Serviços','portrait','#d6a15b','SEU ESTILO','Corte, barba e atendimento premium','Agende agora','classic'],
 ['restaurant','Cardápio especial','Gastronomia','post','#e67545','SABOR DE VERDADE','Conheça nossos pratos e faça seu pedido','Pedir agora','editorial'],
 ['fitness','Academia e treino','Fitness','story','#b6ff47','SUPERE LIMITES','Sua evolução começa hoje','Matricule-se','impact'],
 ['realestate','Imóveis em destaque','Imóveis','portrait','#5ec4e4','SEU NOVO LAR','Encontre o imóvel perfeito para sua família','Saiba mais','editorial'],
 ['beauty','Beleza e estética','Beleza','story','#e5a3d3','REALCE SUA BELEZA','Cuidados especiais para você','Agende','classic'],
 ['clinic','Clínica e saúde','Saúde','post','#60d6c1','CUIDAR DE VOCÊ','Atendimento humano e especializado','Entre em contato','minimal'],
 ['education','Curso e formação','Educação','wide','#5ba6ff','APRENDA MAIS','Desenvolva suas habilidades com qualidade','Inscreva-se','editorial'],
 ['tech','Tecnologia e IA','Tecnologia','wide','#7e84ff','IDEIAS EM AÇÃO','Soluções inteligentes para seu negócio','Conheça','neon'],
 ['agency','Agência criativa','Marketing','wide','#fa68bd','CRIATIVIDADE QUE VENDE','Estratégias que fortalecem marcas','Fale conosco','impact'],
 ['event','Eventos e festas','Eventos','story','#ffab51','VOCÊ É CONVIDADO','Uma experiência para celebrar e lembrar','Participe','neon'],
 ['travel','Viagens e turismo','Turismo','portrait','#42c4c1','DESCUBRA DESTINOS','Experiências inesquecíveis esperam por você','Explore','editorial'],
 ['shop','Loja e comércio','Varejo','post','#ee7091','NOVIDADES DA LOJA','Os melhores produtos você encontra aqui','Comprar','impact'],
 ['minimal','Editorial minimalista','Institucional','portrait','#b1c6e3','SUA MARCA','Uma comunicação simples e elegante','Saiba mais','minimal'],
 ['testimonial','Depoimento de cliente','Marketing','post','#d1b5ff','CLIENTES SATISFEITOS','A experiência que faz a diferença','Confira','classic'],
 ['pet','Pet shop','Pets','post','#f7c45c','AMOR POR PETS','Tudo para cuidar do seu melhor amigo','Saiba mais','editorial'],
 ['delivery','Delivery rápido','Gastronomia','story','#ff7f60','PEÇA AGORA','Sabor e praticidade na sua casa','Fazer pedido','impact'],
 ['automotive','Oficina e serviços','Serviços','wide','#e5bd59','CUIDADO COM SEU CARRO','Qualidade e confiança em cada serviço','Agende','impact'],
 ['blackfriday','Black Friday','Marketing','post','#ffcf2a','MEGA OFERTAS','O momento certo para aproveitar','Não perca','impact']
];
const data=templates.map(([id,name,category,canvasFormat,accent,headline,subtitle,cta,preset])=>({id,name,category,canvasFormat,accent,headline,subtitle,cta,preset,template: ['launch','tech','event'].includes(id)?'glow':['minimal','clinic','education'].includes(id)?'minimal':'cinematic',tags:(name+' '+category+' '+headline+' '+subtitle).toLowerCase()}));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const find=(q='',category='Todos')=>data.filter(t=>(category==='Todos'||t.category===category)&&normalize(t.tags).includes(normalize(q)));
root.ALEGON_DESIGN_TEMPLATES=Object.freeze({all:data,categories:['Todos',...new Set(data.map(t=>t.category))],find,get:id=>data.find(t=>t.id===id)});
})(typeof window!=='undefined'?window:globalThis);
