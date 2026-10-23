import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { isRecord, json, readJsonObject, requireSameOrigin } from "../app/lib/request-safety.ts";

const root = resolve(new URL("..", import.meta.url).pathname);

test("mutating requests reject missing, null, and foreign origins", async () => {
  for (const origin of [undefined, "null", "https://attacker.example"]) {
    const headers = origin ? { origin } : {};
    const response = requireSameOrigin(new Request("https://radar.example/api/action", { method: "POST", headers }));
    assert.ok(response instanceof Response);
    assert.equal(response.status, 403);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }
});

test("same-origin request is accepted", () => {
  const response = requireSameOrigin(new Request("https://radar.example/api/action", {
    method: "POST", headers: { origin: "https://radar.example" },
  }));
  assert.equal(response, null);
});

test("JSON reader accepts only bounded JSON objects", async () => {
  assert.deepEqual(await readJsonObject(new Request("https://radar.example/api", {
    method: "POST", body: JSON.stringify({ name: "Loja" }),
  }), 64), { name: "Loja" });
  assert.equal(await readJsonObject(new Request("https://radar.example/api", {
    method: "POST", body: JSON.stringify(Array(100).fill("x")),
  }), 64), null);
  assert.equal(await readJsonObject(new Request("https://radar.example/api", {
    method: "POST", body: "{invalid",
  })), null);
  assert.equal(await readJsonObject(new Request("https://radar.example/api", {
    method: "POST", headers: { "content-length": "1000" }, body: "{}",
  }), 32), null);
  assert.equal(await readJsonObject(new Request("https://radar.example/api", {
    method: "POST", body: JSON.stringify({ value: "x".repeat(100) }),
  }), 32), null);
});

test("record guard excludes arrays and null", () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
});

test("API JSON responses are not cacheable", async () => {
  const response = json({ ok: true });
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.deepEqual(await response.json(), { ok: true });
});

test("same-origin check rejects an origin with a deceptive suffix", () => {
  const response = requireSameOrigin(new Request("https://radar.example/api/action", {
    method: "POST", headers: { origin: "https://radar.example.attacker.example" },
  }));
  assert.equal(response?.status, 403);
});

test("same-origin check rejects malformed origin URLs", () => {
  const response = requireSameOrigin(new Request("https://radar.example/api/action", {
    method: "POST", headers: { origin: "not a url" },
  }));
  assert.equal(response?.status, 403);
});

test("same-origin check compares scheme and port", () => {
  for (const origin of ["http://radar.example", "https://radar.example:444"]) {
    const response = requireSameOrigin(new Request("https://radar.example/api/action", {
      method: "POST", headers: { origin },
    }));
    assert.equal(response?.status, 403);
  }
});

test("bounded JSON reader rejects primitive and null JSON", async () => {
  for (const body of ["null", "true", "42", '"text"']) {
    assert.equal(await readJsonObject(new Request("https://radar.example/api", { method: "POST", body })), null);
  }
});

test("bounded JSON reader rejects declared oversize before parsing", async () => {
  const request = new Request("https://radar.example/api", {
    method: "POST", headers: { "content-length": "999999" }, body: "{}",
  });
  assert.equal(await readJsonObject(request, 64), null);
});

test("JSON responses preserve caller headers while enforcing no-store", () => {
  const response = json({ ok: true }, 201, { "x-content-type-options": "nosniff", "cache-control": "public" });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
});

test("mutating API handlers enforce origin and authenticated user checks", async () => {
  const files = [
    "app/api/auth/login/route.ts", "app/api/auth/register/route.ts", "app/api/auth/logout/route.ts",
    "app/api/auth/me/route.ts", "app/api/tomtom-search/route.ts",
    "app/api/whatsapp/send/route.ts", "app/api/generate-site/route.ts", "app/api/admin/users/route.ts",
  ];
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.match(source, /requireSameOrigin\(request\)/, `${file} missing origin validation`);
  }
});

test("provider credential checks are behind authenticated route guards", async () => {
  const source = await readFile(resolve(root, "app/api/tomtom-search/route.ts"), "utf8");
  const getHandler = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  assert.match(getHandler, /requireUser\(request\)/);
});

test("worker defines browser security response headers", async () => {
  const source = await readFile(resolve(root, "build/sites-worker.ts"), "utf8");
  for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options"]) {
    assert.ok(source.includes(header), `missing ${header}`);
  }
});

test("checked-in frontend files contain no recognizable provider key assignment", async () => {
  const files = ["public/radar.html", "public/login.html", "public/studio.html", "public/crm.html", "public/admin.html"];
  const pattern = /(?:sk-[A-Za-z0-9]{24,}|(?:TOMTOM|DEEPSEEK)_API_KEY\s*[:=]\s*["'][^"']{8,}["'])/;
  for (const file of files) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.doesNotMatch(source, pattern, `${file} contains a possible credential`);
  }
});


test("radar clearly counts businesses without a website URL, not businesses with a website", async () => {
  const source = await readFile(resolve(root, "public/radar.html"), "utf8");
  assert.match(source, /Sem site identificado/);
  assert.match(source, /mNoSite'\)\.textContent=a\.filter\(x=>!safeUrl\(x\.site\)\)\.length/);
  assert.match(source, /Ausência de URL não comprova ausência de site/);
});


test("opportunity filters are independent from third-party export restrictions", async () => {
  const source = await readFile(resolve(root, "public/radar.html"), "utf8");
  assert.match(source, /if\(site==='nosite'&&hasSite\)return false/);
  assert.match(source, /if\(S\.quick&&\(!x\.food\|\|hasSite\|\|x\.menu\)\)return false/);
  assert.match(source, /exportable:false,food:FOOD\.has\(cat\)/);
  assert.match(source, /const capped=capResults\(\[\],S\.tomtom/);
});

test("provider merge deduplicates nearby same-name places and preserves distinct locations", async () => {
  const source = await readFile(resolve(root, "public/radar.html"), "utf8");
  const match = source.match(/function capResults\(osm,tomtom,limit\)\{[^\n]*?return chosen\}/);
  assert.ok(match, "capResults implementation should exist");
  const { runInNewContext } = await import("node:vm");
  const dist = (a,b,c,d) => {
    const R=6371000,p=Math.PI/180,dl=(c-a)*p,dn=(d-b)*p;
    const z=Math.sin(dl/2)**2+Math.cos(a*p)*Math.sin(dn/2)**2;
    return 2*R*Math.atan2(Math.sqrt(z),Math.sqrt(1-z));
  };
  const capResults = runInNewContext(`(${match[0]})`, {dist});
  const osm = [{name:"Café São José",lat:-25.42,lon:-49.27},{name:"Café São José",lat:-25.45,lon:-49.30}];
  const tomtom = [{name:"Cafe Sao Jose",lat:-25.4202,lon:-49.2702},{name:"Mercado Central",lat:-25.43,lon:-49.28}];
  const result = capResults(osm,tomtom,10);
  assert.equal(result.osm.length+result.tomtom.length,3,"same-name nearby lead should be merged");
  const capped = capResults(osm,tomtom,2);
  assert.equal(capped.osm.length+capped.tomtom.length,2,"limit must apply to combined sources");
  assert.equal(capResults([],[],10).osm.length+capResults([],[],10).tomtom.length,0);
});

test("deduplication: five scenarios for names phones and distance", async () => {
  const source=await readFile(resolve(root,"public/radar.html"),"utf8");
  const match=source.match(/function capResults\(osm,tomtom,limit\)\{[^\n]*?return chosen\}/);
  assert.ok(match);
  const {runInNewContext}=await import("node:vm");
  const dist=(a,b,c,d)=>{const R=6371000,p=Math.PI/180,dl=(c-a)*p,dn=(d-b)*p,z=Math.sin(dl/2)**2+Math.cos(a*p)*Math.sin(dn/2)**2;return 2*R*Math.atan2(Math.sqrt(z),Math.sqrt(1-z))};
  const merge=runInNewContext(`(${match[0]})`,{dist});
  const count=r=>r.osm.length+r.tomtom.length;
  // 1. Accented names and nearby locations match.
  assert.equal(count(merge([{name:"Café João",lat:-25.42,lon:-49.27}],[{name:"Cafe Joao",lat:-25.4201,lon:-49.2701}],10)),1);
  // 2. Equivalent BR phones match despite different locations and +55 prefix.
  assert.equal(count(merge([{name:"Mercado Sol",phone:"+55 (41) 99999-1234"}],[{name:"Mercado Sol",phone:"41999991234"}],10)),1);
  // 3. Similar names with different phones and distant locations stay distinct.
  assert.equal(count(merge([{name:"Mercado Sol",phone:"41999991234",lat:-25.42,lon:-49.27}],[{name:"Mercado Sol",phone:"41999991235",lat:-25.45,lon:-49.30}],10)),2);
  // 4. Identical names without phone or location remain distinct rather than false merged.
  assert.equal(count(merge([{name:"Loja Nova"}],[{name:"Loja Nova"}],10)),2);
  // 5. Limit applies across both providers and zero limit returns none.
  assert.equal(count(merge([{name:"A"},{name:"B"}],[{name:"C"},{name:"D"}],3)),3);
  assert.equal(count(merge([{name:"A"}],[{name:"B"}],0)),0);
});

test("opportunity score: five deterministic scenarios", async () => {
  const source=await readFile(resolve(root,"public/radar.html"),"utf8");
  const scoreSource=source.match(/function score\(x\)\{[^\n]*?\}/)?.[0];
  assert.ok(scoreSource);
  const {runInNewContext}=await import("node:vm");
  const safeUrl=v=>{try{const url=new URL(v);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}};
  const score=runInNewContext(`(${scoreSource})`,{safeUrl});
  assert.equal(score({site:"",phone:"",food:false}),65,"missing website only");
  assert.equal(score({site:"",phone:"41999999999",food:false}),90,"missing website and contact");
  assert.equal(score({site:"https://business.example",phone:"",food:false}),0,"website present");
  assert.equal(score({site:"",phone:"",food:true}),75,"food business without website");
  assert.equal(score({site:"",phone:"41999999999",food:true}),100,"score capped at 100");
});

test("TomTom Details proxy: five safeguards",async()=>{
 const source=await readFile(resolve(root,"app/api/tomtom-details/route.ts"),"utf8");
 // 1: matches the official service version and route, using user data only for path segments
 assert.match(source,/maps\/orbis\/places\/details\/pois/);assert.match(source,/"TomTom-Api-Version": "3"/);
 // 2: credentials are server-only and session is authenticated
 assert.match(source,/env\.TOMTOM_API_KEY/);assert.match(source,/requireUser\(request\)/);
 // 3: origin and rate limiting protect the API
 assert.match(source,/requireSameOrigin\(request\)/);assert.match(source,/checkRateLimit/);
 // 4: reject invalid identifiers to prevent arbitrary URLs and injection
 assert.match(source,/\^\[a-zA-Z0-9_-\]\{8,160\}\$/);
 assert.match(source,/encodeURIComponent\(id\)/);
 // 5: never persist provider data; handle upstream errors and disable caching
 assert.match(source,/"Cache-Control": "no-store, private"/);
 assert.match(source,/response\.status === 429/);
 assert.doesNotMatch(source,/db\(\)|INSERT INTO|localStorage|sessionStorage/);
});

test("TomTom Geocoding fallback: five validation checks",async()=>{
 const api=await readFile(resolve(root,"app/api/tomtom-geocode/route.ts"),"utf8");
 const radar=await readFile(resolve(root,"public/radar.html"),"utf8");
 // 1: documented Geocoding v2 parameters
 assert.match(api,/maps\/orbis\/places\/geocode/);assert.match(api,/"TomTom-Api-Version":"2"/);
 // 2: authenticated secret-backed API and fixed provider host
 assert.match(api,/requireUser\(request\)/);assert.match(api,/env\.TOMTOM_API_KEY/);
 // 3: rate limit and Brazilian coordinate bounds
 assert.match(api,/checkRateLimit/);assert.match(api,/lat < -35\|\|lat > 6/);
 // 4: Nominatim remains primary, fallback handles errors, abort remains abort
 assert.match(radar,/return pickBoundary\(await geocode\(query,signal\)\)/);
 assert.match(radar,/if\(error\?\.name==='AbortError'\)throw error/);
 assert.match(radar,/return await tomtomGeocode\(query,signal\)/);
 // 5: fallback is used for both city and neighborhood and returns shape compatible with center
 assert.match(radar,/const cityObj=await locateRegion\(city/);
 assert.match(radar,/target=await locateRegion\(neighborhood/);
 assert.match(radar,/osm_type:'tomtom'/);
});

test("CRM compliance gate: five checks",async()=>{const crm=await readFile(resolve(root,"public/crm.html"),"utf8");const radar=await readFile(resolve(root,"public/radar.html"),"utf8");const studio=await readFile(resolve(root,"public/studio.html"),"utf8");const api=await readFile(resolve(root,"app/api/crm/leads/route.ts"),"utf8");assert.match(crm,/CRM desativado/);assert.match(crm,/location\.replace\("\/radar\.html"\)/);assert.doesNotMatch(radar,/href="\/crm\.html"/);assert.doesNotMatch(studio,/href="\/crm\.html"/);assert.match(api,/status: 410/);});

test("motion cover templates: five privacy and usability safeguards",async()=>{
 const page=await readFile(resolve(root,"public/video-studio.html"),"utf8");
 const studio=await readFile(resolve(root,"public/studio.html"),"utf8");
 // 1. Auth redirect prevents unauthenticated access.
 assert.match(page,/fetch\('\/api\/auth\/me'/);assert.match(page,/login\.html\?next=%2Fvideo-studio\.html/);
 // 2. Four distinct templates in responsive 9:16 layout.
 for(const name of ['cinematic','slide','glow','minimal'])assert.match(page,new RegExp('value="'+name+'"'));
 assert.match(page,/aspect-ratio:9\/16/);
 // 3. Uploaded photo local, MIME and size guarded.
 assert.match(page,/URL\.createObjectURL\(file\)/);assert.match(page,/file\.size>5\*1024\*1024/);
 // 4. Text injected with textContent only; no arbitrary HTML.
 assert.match(page,/\$\('outTitle'\)\.textContent/);assert.doesNotMatch(page,/\.innerHTML\s*=/);
 // 5. Motion accessibility and discoverability.
 assert.match(page,/prefers-reduced-motion:reduce/);assert.doesNotMatch(studio,/href="\/video-studio\.html"/);
 const radar=await readFile(resolve(root,"public/radar.html"),"utf8");assert.match(radar,/href="\/video-studio\.html"/);
});

test("superadmin account deletion: five safety checks",async()=>{
const html=await readFile(resolve(root,"public/admin.html"),"utf8");
const api=await readFile(resolve(root,"app/api/admin/users/route.ts"),"utf8");
assert.match(html,/prompt\('Exclusão irreversível: digite o e-mail completo/);
assert.match(html,/if\(confirmEmail!==user\.email\)return/);
assert.match(html,/body:JSON\.stringify\(\{confirmEmail\}\)/);
assert.match(api,/if \(confirmEmail !== target\.email\) return json/);
assert.match(api,/if \(id === admin\.id\)/);
assert.match(api,/configuredAdminEmail\(\)/);
assert.match(api,/requireSameOrigin\(request\)/);
});

test("Final release gate: CRM API is disabled in all five compliance checks",async()=>{
 const route=await readFile(resolve(root,"app/api/crm/leads/route.ts"),"utf8");
 const ui=await readFile(resolve(root,"public/crm.html"),"utf8");
 for(const method of ["GET","POST","PATCH","DELETE"])assert.match(route,new RegExp("export async function "+method+"\\(\\) \\{ return unavailable\\(\\); \\}"));
 assert.match(route,/status: 410/);
 assert.doesNotMatch(route,/INSERT INTO|UPDATE radar_leads|DELETE FROM radar_leads/);
 assert.match(ui,/CRM desativado/);
});

test("Commercial site generator: five quality-control checks",async()=>{
const src=await readFile(resolve(root,"app/api/generate-site/route.ts"),"utf8");
// 1. Sector-matched visual directions prevent generic output.
for(const sector of ["gastronomia","barbearia","beleza-saude","fitness","varejo","servicos"])assert.ok(src.includes(sector));
// 2. Tangible palette, typography and hero direction for every vertical.
assert.match(src,/const designTokens=/);assert.match(src,/palette:/);assert.match(src,/font:/);assert.match(src,/hero:/);
// 3. Use real data only, and guard WhatsApp and menu placeholders.
assert.match(src,/knownFacts: known|knownFacts:known/);assert.match(src,/Não chamar telefone de WhatsApp/);assert.match(src,/Não criar tabelas de preços/);
// 4. System delivers clear art direction and factual briefing to the model.
assert.match(src,/DIREÇÃO DE ARTE: \$\{JSON.stringify\(creativeBrief\)\}/);assert.match(src,/BRIEFING FACTUAL:/);
// 5. Reject flawed generated output before user preview.
assert.match(src,/SITE_QUALITY_GATE/);assert.match(src,/sem regra responsiva identificada/);assert.match(src,/WhatsApp sem número confirmado/);
});

test("Premium site photos: five safeguards",async()=>{const api=await readFile(resolve(root,"app/api/generate-site/route.ts"),"utf8");const ui=await readFile(resolve(root,"public/studio.html"),"utf8");assert.match(ui,/id="photos"/);assert.match(ui,/URLs, uma por linha/);assert.match(api,/safeHttpUrl\(x,500\)/);assert.match(api,/slice\(0,8\)/);assert.match(api,/Não pesquise nem copie fotos do Google Maps/);});

test("Google Places Photos cost/consent: five release safeguards",async()=>{const api=await readFile(resolve(root,"app/api/google-place-photos/route.ts"),"utf8");const ui=await readFile(resolve(root,"public/studio.html"),"utf8");assert.match(api,/requireUser\(request\)/);assert.match(api,/requireSameOrigin\(request\)/);assert.match(api,/confirmPaidRequests!==true/);assert.match(api,/GOOGLE_MAPS_API_KEY/);assert.match(api,/slice\(0,3\)/);assert.match(ui,/googlePhotosPreview/);assert.match(ui,/confirm\('Esta ação pode consumir franquia/);assert.match(ui,/não serão copiadas para o site/);});

test("Business photos: five upload and composition safeguards",async()=>{const ui=await readFile(resolve(root,"public/studio.html"),"utf8");assert.match(ui,/id="imageMode"/);for(const mode of ["illustrative","own","mixed"])assert.match(ui,new RegExp('value="'+mode+'"'));assert.match(ui,/businessImages\.length>=10/);assert.match(ui,/file\.size>5\*1024\*1024/);assert.match(ui,/businessImages\.slice\(0,6\)/);assert.match(ui,/compressBusinessPhoto\(file\)/);assert.match(ui,/composeBusinessGallery\(next\)/);assert.match(ui,/não são enviadas à DeepSeek|html:removeBusinessGallery\(currentHtml\)/);});

test("Assisted business media: security and attribution",async()=>{const api=await readFile(resolve(root,"app/api/business-media/route.ts"),"utf8");const ui=await readFile(resolve(root,"public/studio.html"),"utf8");assert.match(api,/requireUser\(request\)/);assert.match(api,/requireSameOrigin\(request\)/);assert.match(api,/checkRateLimit\(/);assert.match(api,/redirect:"manual"/);assert.match(api,/safeSite\(body.site\)/);assert.match(api,/PEXELS_API_KEY/);assert.match(ui,/mediaRights/);assert.match(ui,/Definir capa/);assert.match(ui,/discoverSiteMedia/);assert.match(ui,/discoverUnsplash/);});

test("R2 private authorized upload: five constraints",async()=>{const api=await readFile(resolve(root,"app/api/business-media/upload/route.ts"),"utf8");assert.match(api,/requireSameOrigin\(request\)/);assert.match(api,/requireUser\(request\)/);assert.match(api,/!env\.BUCKET/);assert.match(api,/authorized!=="yes"/);assert.match(api,/file\.size>5\*1024\*1024/);assert.match(api,/crypto\.randomUUID\(\)/);assert.match(api,/private:true/);});

test("Unsplash illustration integration uses secret and honest source labels",async()=>{const api=await readFile(resolve(root,"app/api/business-media/route.ts"),"utf8");const ui=await readFile(resolve(root,"public/studio.html"),"utf8");const envType=await readFile(resolve(root,"cloudflare-env.d.ts"),"utf8");assert.match(api,/env\.UNSPLASH_ACCESS_KEY/);assert.match(api,/api\.unsplash\.com\/search\/photos/);assert.match(api,/Client-ID/);assert.match(api,/license:"unsplash"/);assert.match(ui,/discoverBusinessMedia\('unsplash'\)/);assert.match(ui,/Ilustrativa Unsplash/);assert.match(ui,/Ver fonte no Unsplash/);assert.match(envType,/UNSPLASH_ACCESS_KEY\?: string/);});

test("Menu and library: script syntax and no automatic video generation",async()=>{const vm=await import("node:vm");for(const file of ["public/menu-studio.html","public/library.html"]){const html=await readFile(resolve(root,file),"utf8");assert.match(html,/<meta name="viewport"/);for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(script[1]));assert.doesNotMatch(html,/MediaRecorder|video\/mp4|three\.js/i)}const menu=await readFile(resolve(root,"public/menu-studio.html"),"utf8");assert.match(menu,/alegon-menu-v1/);assert.match(menu,/prefers-reduced-motion/);assert.match(menu,/application\/json/);const lib=await readFile(resolve(root,"public/library.html"),"utf8");assert.match(lib,/image\/svg\+xml/);assert.ok(lib.includes('/api/library'));});
test("Global ALEGON library: D1 isolation and admin-only publishing",async()=>{const sql=await readFile(resolve(root,"drizzle/0001_alegon_library.sql"),"utf8"),api=await readFile(resolve(root,"app/api/library/route.ts"),"utf8");assert.match(sql,/alegon_library_templates/);assert.match(sql,/alegon_library_projects/);assert.match(api,/requirePlan\(request,"pro"\)/);assert.match(api,/requireSameOrigin\(request\)/);assert.match(api,/global&&!isAdmin\(user.email\)/);assert.match(api,/WHERE user_id=\?/);assert.match(api,/published=1/);});

test("SEO and security headers: public metadata, private application",async()=>{const config=await readFile(resolve(root,"next.config.ts"),"utf8"),robots=await readFile(resolve(root,"app/robots.ts"),"utf8"),sitemap=await readFile(resolve(root,"app/sitemap.ts"),"utf8"),landing=await readFile(resolve(root,"app/sobre/page.tsx"),"utf8");for(const header of ["X-Content-Type-Options","X-Frame-Options","Referrer-Policy","Content-Security-Policy","Permissions-Policy","Strict-Transport-Security"])assert.ok(config.includes(header));assert.match(robots,/admin\.html/);assert.match(robots,/api\//);assert.match(sitemap,/sobre/);assert.match(landing,/index:true/);assert.match(config,/noindex, nofollow/);});
test("Sensitive registration errors are not logged to production",async()=>{const src=await readFile(resolve(root,"app/api/auth/register/route.ts"),"utf8");assert.doesNotMatch(src,/console\.error\("Cadastro Radar falhou"/);assert.match(src,/checkRateLimit\(/);assert.match(src,/hashPassword\(/);});

test("Hardening: external website fetch and library cross-account safeguards",async()=>{const site=await readFile(resolve(root,"app/api/business-media/route.ts"),"utf8"),library=await readFile(resolve(root,"app/api/library/route.ts"),"utf8"),headers=await readFile(resolve(root,"next.config.ts"),"utf8");assert.match(site,/u\.protocol!=="https:"/);assert.match(site,/blockedSuffixes/);assert.match(site,/redirect:"manual"/);assert.match(site,/safeSite\(u\.toString\(\)\)/);assert.match(library,/WHERE user_id=\?/);assert.match(library,/AND user_id=\?/);assert.match(library,/published=1 LIMIT 1/);assert.match(library,/original\.type!==type/);assert.match(headers,/script-src-attr 'none'/);assert.match(headers,/connect-src 'self'/);});

test("TomTom and studio UX: nested contacts, details enrichment and minimal first screen",async()=>{const search=await readFile(resolve(root,"app/api/tomtom-search/route.ts"),"utf8"),details=await readFile(resolve(root,"app/api/tomtom-details/route.ts"),"utf8"),radar=await readFile(resolve(root,"public/radar.html"),"utf8"),studio=await readFile(resolve(root,"public/studio.html"),"utf8"),library=await readFile(resolve(root,"public/library.html"),"utf8");assert.match(search,/extractTomtomContacts/);assert.match(details,/extractTomtomContacts/);assert.match(radar,/enrichVisibleContacts/);assert.match(radar,/\/api\/tomtom-details/);assert.match(radar,/placeId:p\.id/);assert.match(studio,/optional-brief/);assert.match(studio,/advancedBrief/);assert.match(library,/exemplos genéricos sem design editável/);});

test("Selected lead details are resolved before Studio navigation",async()=>{const radar=await readFile(resolve(root,"public/radar.html"),"utf8");assert.match(radar,/async function openStudioWithLead/);assert.match(radar,/await enrichOneLead\(x\)/);assert.match(radar,/if\(x.detailsPromise\)return x.detailsPromise/);assert.match(radar,/response.status===429/);});

test("TomTom parser handles nested phones and websites without fabricated contacts",async()=>{const {extractTomtomContacts,tomtomAddress}=await import("../app/lib/tomtom-contacts.ts");const c=extractTomtomContacts([{phones:[{number:"+5541999999999"}],websites:[{url:"https://example.com"}]}]);assert.deepEqual(c.phones,["+5541999999999"]);assert.deepEqual(c.websites,["https://example.com"]);assert.equal(extractTomtomContacts([]).phone,"");assert.equal(tomtomAddress({street:"Rua A",houseNumber:"12"},[]),"Rua A, 12");});

test("OSM only complements a selected TomTom establishment and never searches cities",async()=>{const route=await readFile(resolve(root,"app/api/osm-enrich/route.ts"),"utf8"),radar=await readFile(resolve(root,"public/radar.html"),"utf8");assert.match(route,/requireUser\(request\)/);assert.match(route,/requireSameOrigin\(request\)/);assert.match(route,/checkRateLimit/);assert.match(route,/around:45/);assert.match(route,/matchingName\(name,tags\)/);assert.match(route,/meters>60/);assert.match(route,/© OpenStreetMap contributors/);assert.doesNotMatch(route,/bbox=|OverpassQL.*city|googleapis\.com/);assert.match(radar,/if\(\(!x\.phone\|\|!x\.site\|\|!x\.email\)\&\&!x\.osmChecked\)await enrichWithOsm\(x\)/);assert.match(radar,/Complementar dados OSM/);assert.match(radar,/Perfil no Google/);});

test("AI generation quotas bind project to each lead and cap three AI edits",async()=>{const quota=await readFile(resolve(root,"app/lib/site-ai-quotas.ts"),"utf8"),route=await readFile(resolve(root,"app/api/generate-site/route.ts"),"utf8"),studio=await readFile(resolve(root,"public/studio.html"),"utf8");assert.match(quota,/generations<|generations=1/);assert.match(quota,/refinements<3/);assert.match(quota,/MAX_ACCOUNT_REQUESTS_MONTH=12/);assert.match(quota,/MAX_ACCOUNT_TOKENS_MONTH=90000/);assert.match(route,/reserveSiteRequest\(actor.id/);assert.match(route,/max_tokens: 7000/);assert.match(studio,/projectId,placeId,brief:values/);assert.match(studio,/aiEditsRemaining<=0/);assert.match(studio,/Editar na prévia/);});

test("DeepSeek reserves input and output tokens before any paid request",async()=>{
 const route=await readFile(resolve(root,"app/api/generate-site/route.ts"),"utf8");
 const quota=await readFile(resolve(root,"app/lib/site-ai-quotas.ts"),"utf8");
 const sql=await readFile(resolve(root,"drizzle/0002_site_ai_quotas.sql"),"utf8");
 const deploy=await readFile(resolve(root,"scripts/deploy-cloudflare.mjs"),"utf8");
 assert.match(route,/reservedTokens=new TextEncoder\(\)\.encode\(system\+promptText\)\.byteLength\+7000/);
 assert.ok(route.indexOf("reserveSiteRequest(actor.id")<route.indexOf('fetch("https://api.deepseek.com/chat/completions"'));
 assert.ok(route.indexOf("recordTokenUsage(actor.id")<route.indexOf("if (!response.ok)"));
 assert.match(quota,/tokens\+excluded\.tokens<=\?/);
 assert.match(quota,/input_tokens=input_tokens\+\?/);
 assert.match(quota,/output_tokens=output_tokens\+\?/);
 assert.match(sql,/input_tokens INTEGER NOT NULL/);
 assert.match(sql,/output_tokens INTEGER NOT NULL/);
 assert.match(deploy,/drizzle\/0002_site_ai_quotas\.sql/);
});

test("Unified monthly credits have one fixed Discover cost for 10, 20 or 35 cards", async()=>{
 const credit=await readFile(resolve(root,"app/lib/usage-credits.ts"),"utf8");
 const search=await readFile(resolve(root,"app/api/tomtom-search/route.ts"),"utf8");
 const ai=await readFile(resolve(root,"app/api/generate-site/route.ts"),"utf8");
 const deploy=await readFile(resolve(root,"scripts/deploy-cloudflare.mjs"),"utf8");
 const page=await readFile(resolve(root,"public/radar.html"),"utf8");
 assert.match(credit,/MONTHLY_CREDITS = 700/);
 assert.match(credit,/discover: 10/);
 assert.match(search,/\[10, 20, 35\]\.includes\(requestedLimit\)/);
 assert.match(search,/reserveCredits\(user.id, "discover"\)/);
 assert.match(credit,/WHERE used\+excluded\.used<=\?/);
 assert.match(ai,/reserveSiteRequest\(actor.id/);
 assert.match(ai,/reserveCredits\(actor.id,mode\)/);
 assert.match(deploy,/drizzle\/0003_usage_credits\.sql/);
 assert.match(page,/id="creditsBalance"/);
});

test("Subscription tiers: signup requests never confer paid access; library is server-guarded", async()=>{const read=async p=>readFile(resolve(root,p),"utf8");const [migration,signup,admin,library,subscriptions,deploy]=await Promise.all(["drizzle/0004_subscription_plans.sql","app/api/auth/register/route.ts","app/api/admin/users/route.ts","app/api/library/route.ts","app/lib/subscriptions.ts","scripts/deploy-cloudflare.mjs"].map(read));assert.match(signup,/requested_plan,active_plan/);assert.match(signup,/essential/);assert.match(admin,/planOnly/);assert.match(admin,/validPlan/);assert.match(library,/requirePlan\(request,"pro"\)/);assert.match(subscriptions,/PLAN_REQUIRED/);assert.match(migration,/alegon_user_plans/);assert.match(deploy,/0004_subscription_plans/);});


test("creative canvas format and reusable element normalization", async () => {
  const { runInNewContext } = await import("node:vm");
  const core = await readFile(resolve(root, "public/creative-core.js"), "utf8");
  const ctx = { crypto: { randomUUID: () => "test-uuid-1234" } };
  runInNewContext(core, ctx);
  const model = ctx.ALEGON_CREATIVE_CORE;
  assert.equal(model.dimensions("wide").width, 1920);
  assert.equal(model.dimensions("post").height, 1080);
  assert.equal(model.dimensions("unknown").height, 1920);
  const project = model.safeProject({ canvasFormat:"wide",layers:[
    {id:"abcdefgh",kind:"icon",icon:"globe",x:200,width:95,color:"invalid"},
    {id:"ijklmnop",kind:"image",image:"javascript:alert(1)"},
    {id:"qrstuvwx",kind:"rect",width:45,y:-25},
  ] });
  assert.equal(project.canvasFormat,"wide");
  assert.equal(project.layers[0].kind,"icon");
  assert.equal(project.layers[0].x,5);
  assert.equal(project.layers[0].color,"#ffffff");
  assert.equal(project.layers[1].image,"");
  assert.equal(project.layers[2].y,0);
  assert.equal(model.align({id:"abcdefgh",kind:"icon",width:20,x:0}, "x", 50).x,40);
});

test("creative editor uses shared model and keeps brand files private", async () => {
 const html=await readFile(resolve(root,"public/video-studio.html"),"utf8");
 const js=await readFile(resolve(root,"public/alegon-elements.js"),"utf8");
 assert.match(html,/creative-core\.js/);
 assert.match(html,/safeProject\(d\)/);
 assert.match(html,/creative-export\.js/);
 assert.match(html,/canvasFormat/);
 assert.match(js,/ALEGON_ELEMENTS/);
 assert.doesNotMatch(html,/\.innerHTML\s*=/);
});

test("Creative editor tracks layer changes and handles failed images", async()=>{
 const html=await readFile(resolve(root,"public/video-studio.html"),"utf8");
 assert.match(html,/function commitEdit\(\)/);
 assert.match(html,/visibility\.onclick=\(\)=>\{l\.hidden=!l\.hidden;renderLayers\(\);commitEdit\(\)/);
 assert.match(html,/lock\.onclick=\(\)=>\{l\.locked=!l\.locked;renderLayers\(\);commitEdit\(\)/);
 assert.match(html,/img\.complete\)\{img\.naturalWidth\?resolve\(\):reject/);
 assert.match(html,/currentSnapshot=snapshotState\(\)/);
});


test("ALEGON Creative initializes editable layers before controls and tracks history",async()=>{
 const html=await readFile(resolve(root,"public/video-studio.html"),"utf8");
 assert.match(html,/let photoUrl='',photoImage=null,email='',layers=\[\],selectedLayerId=''/);
 assert.match(html,/function commitEdit\(\)\{queueMicrotask\(syncHistory\)\}/);
 assert.match(html,/visibility\.onclick=\(\)=>\{l\.hidden=!l\.hidden;renderLayers\(\);commitEdit\(\)/);
 assert.match(html,/lock\.onclick=\(\)=>\{l\.locked=!l\.locked;renderLayers\(\);commitEdit\(\)/);
 assert.match(html,/img\.complete\)\{img\.naturalWidth\?resolve\(\):reject/);
 const scripts=html.split("<script>").slice(1).map(chunk=>chunk.split("</script>")[0]).filter(Boolean);
 for(const source of scripts)assert.doesNotThrow(()=>new Function(source));
});
test("Creative typography survives normalization and UI scripts have unique history helpers",async()=>{
 const {runInNewContext}=await import("node:vm");
 const core=await readFile(resolve(root,"public/creative-core.js"),"utf8");
 const ctx={crypto:{randomUUID:()=>"test-uuid-1234"}};runInNewContext(core,ctx);
 const valid=ctx.ALEGON_CREATIVE_CORE.layer({id:"abcdefgh",kind:"text",font:"Georgia",italic:true,shadow:true,spacing:9});
 assert.equal(valid.font,"Georgia");assert.equal(valid.italic,true);assert.equal(valid.shadow,true);assert.equal(valid.spacing,9);
 const invalid=ctx.ALEGON_CREATIVE_CORE.layer({font:"url(javascript:alert(1))",spacing:100});
 assert.equal(invalid.font,"system-ui");assert.equal(invalid.spacing,15);
 const html=await readFile(resolve(root,"public/video-studio.html"),"utf8");
 assert.equal(html.split("function commitEdit(){").length-1,1);
 assert.match(html,/id="layerFont"/);assert.match(html,/id="layerItalic"/);assert.match(html,/id="layerShadow"/);
});
test("Creative clipboard, flip transforms, grid and shortcuts are present",async()=>{const page=await readFile(resolve(root,"public/video-studio.html"),"utf8");const core=await readFile(resolve(root,"public/creative-core.js"),"utf8");for(const id of ["copyLayer","pasteLayer","flipHorizontal","flipVertical","toggleGrid"])assert.ok(page.includes('id="'+id+'"'));assert.match(page,/layerClipboard/);assert.match(page,/l\.flipX=!l\.flipX/);assert.match(core,/flipX:!!l\.flipX,flipY:!!l\.flipY/);assert.doesNotMatch(page,/\.innerHTML\s*=/);});

test("Creative pointer engine constrains resize and handles touch cancellation",async()=>{const page=await readFile(resolve(root,"public/video-studio.html"),"utf8");assert.match(page,/rect\.width\|\|!rect\.height/);assert.match(page,/ev\.pointerId!==e\.pointerId/);assert.match(page,/Math\.min\(l\.x,100-l\.width\)/);assert.match(page,/el\.onpointercancel=finish/);assert.match(page,/if\(moved\)\{renderLayers\(\);commitEdit\(\)\}/);const roadmap=await readFile(resolve(root,"docs/alegon-criativo-roadmap.md"),"utf8");assert.match(roadmap,/Motor de edição confiável/);});

test("Creative export uses one DOM scene for HTML and PNG across formats",async()=>{const [page,source]=await Promise.all(["public/video-studio.html","public/creative-export.js"].map(p=>readFile(resolve(root,p),"utf8")));const {runInNewContext}=await import("node:vm");const context={Blob,crypto:{randomUUID:()=>"test-uuid"}};runInNewContext(source,context);const exp=context.ALEGON_CREATIVE_EXPORT;for(const [format,w,h] of [["story",1080,1920],["post",1080,1080],["portrait",1080,1350],["wide",1920,1080]]){assert.equal(exp.canvasSize(format).width,w);assert.equal(exp.canvasSize(format).height,h)}assert.match(page,/ALEGON_CREATIVE_EXPORT\.png/);assert.match(page,/ALEGON_CREATIVE_EXPORT\.html/);assert.match(source,/scene\.clone\.outerHTML/);assert.match(source,/foreignObject/);assert.match(source,/embedImage\(photoSource\)/);assert.doesNotMatch(source,/https:\/\/api\./);});

test("Creative projects store private asset references and update existing records",async()=>{
 const [core,editor,library,api,exporter]=await Promise.all(["public/creative-core.js","public/video-studio.html","public/library.html","app/api/library/route.ts","public/creative-export.js"].map(p=>readFile(resolve(root,p),"utf8")));
 assert.match(core,/cloudAsset/);assert.match(core,/photoSrc:cloudAsset/);
 assert.match(editor,/uploadCreativeImage/);assert.match(editor,/savedProjectId\?'PATCH':'POST'/);assert.match(editor,/page\.photoSrc=await storeSource\(localPagePhotos\.get\(page\.id\)\|\|page\.photoSrc\)/);
 assert.match(library,/__projectId:item\.id/);assert.match(api,/validateCreativeAssets/);
 assert.match(api,/BUCKET\.head\("creative-assets\/"/);assert.match(exporter,/credentials:ownedAsset\?'same-origin':'omit'/);
 assert.doesNotMatch(editor,/\.innerHTML\s*=/);
});

test("Creative uploads use private authenticated assets instead of embedding large images",async()=>{const editor=await readFile(resolve(root,"public/video-studio.html"),"utf8");const route=await readFile(resolve(root,"app/api/creative-assets/route.ts"),"utf8");assert.match(editor,/form\.append\('image',file\)/);assert.match(editor,/fetch\('\/api\/creative-assets',\{method:'POST'/);assert.match(editor,/file\.size>5\*1024\*1024/);assert.match(route,/requirePlan\(request,"pro"\)/);assert.match(route,/auth\.user\.id/);assert.match(route,/X-Content-Type-Options/);});

test("Creative cloud reopening clears previous cover and requires owned asset",async()=>{const [editor,core,assets,library]=await Promise.all(["public/video-studio.html","public/creative-core.js","app/api/creative-assets/route.ts","app/api/library/route.ts"].map(p=>readFile(resolve(root,p),"utf8")));assert.match(editor,/function fill\(d\)\{resetPhoto\(\)/);assert.match(editor,/cloudPhotoSrc=window\.ALEGON_CREATIVE_CORE\.cloudAsset/);assert.match(editor,/credentials:'same-origin'/);assert.match(assets,/requirePlan\(request,"pro"\)/);assert.match(assets,/creative-assets\/"/);assert.match(library,/validateCreativeAssets/);assert.match(core,/cloudAsset/);});

test("Creative multi-page document supports add, copy, delete, move and legacy projects", async()=>{
 const {runInNewContext}=await import("node:vm");
 const [core,pages,editor,library]=await Promise.all(["public/creative-core.js","public/creative-pages.js","public/video-studio.html","app/api/library/route.ts"].map(p=>readFile(resolve(root,p),"utf8")));
 const context={crypto:{randomUUID:(()=>{let i=0;return()=>("00000000-0000-4000-8000-"+String(++i).padStart(12,"0"))})()}};
 runInNewContext(core+"\n"+pages,context);
 const api=context.ALEGON_CREATIVE_PAGES;
 const original=api.documentModel({projectName:"Campanha",headline:"Promoção",layers:[{id:"abcdefgh",kind:"text",text:"Original"}]});
 assert.equal(original.pages.length,1);assert.equal(original.pages[0].headline,"Promoção");
 const added=api.add(original);assert.equal(added.pages.length,2);assert.notEqual(added.activePageId,original.activePageId);
 const copied=api.duplicate(added,original.pages[0].id);assert.equal(copied.pages.length,3);assert.equal(copied.pages[1].headline,"Promoção");
 const reordered=api.move(copied,copied.activePageId,1);assert.equal(reordered.pages[2].id,copied.activePageId);
 const removed=api.remove(copied,copied.activePageId);assert.equal(removed.pages.length,2);
 let capped=original;for(let i=0;i<15;i++)capped=api.add(capped);assert.equal(capped.pages.length,10);
 for(const id of ["addPage","duplicatePage","deletePage","pageUp","pageDown","pageTabs"])assert.ok(editor.includes('id="'+id+'"'));
 assert.match(editor,/documentSnapshot\(\)/);assert.match(editor,/loadDocument\(data\)/);
 assert.match(library,/pages\.length>10/);assert.match(library,/creative-assets\/"/);
});

test("Creative cloud save keeps live document untouched until upload and database succeed",async()=>{const editor=await readFile(resolve(root,"public/video-studio.html"),"utf8");assert.match(editor,/const before=JSON\.stringify\(documentSnapshot\(\)\)/);assert.match(editor,/const draft=JSON\.parse\(before\),copies=new Map\(\)/);assert.match(editor,/if\(!res\.ok\)throw Error/);assert.match(editor,/creativeDoc=payload;localPagePhotos\.clear\(\)/);assert.match(editor,/workspace\.inert=true/);assert.match(editor,/workspace\.inert=false/);assert.match(editor,/for\(const url of oldPhotos\)/);});

test("Creative primary save persists all pages and distinguishes local draft",async()=>{const page=await readFile(resolve(root,"public/video-studio.html"),"utf8");assert.match(page,/id="quickSave">Salvar na nuvem/);assert.match(page,/\$\('quickSave'\)\.onclick=\(\)=>\$\('saveLibrary'\)\.click\(\)/);assert.match(page,/const before=JSON\.stringify\(documentSnapshot\(\)\)/);assert.match(page,/for\(let index=0;index<draft\.pages\.length;index\+\+\)/);assert.match(page,/Fotos ainda não enviadas ficam disponíveis apenas nesta sessão/);});

test("Creative typography presets and effects validate safe font and style options",async()=>{const {runInNewContext}=await import("node:vm");const core=await readFile(resolve(root,"public/creative-core.js"),"utf8");const ctx={crypto:{randomUUID:()=> "00000000-0000-4000-8000-000000000001"}};runInNewContext(core,ctx);const c=ctx.ALEGON_CREATIVE_CORE;const p=c.preset("neon");assert.equal(p.textEffect,"neon");assert.equal(c.preset("unknown"),null);const clean=c.layer({id:"abcdefgh",font:"javascript:bad",textEffect:"invalid",underline:true,outlineWidth:50,letterHeight:9});assert.equal(clean.font,"system-ui");assert.equal(clean.textEffect,"none");assert.equal(clean.underline,true);assert.equal(clean.outlineWidth,5);assert.equal(clean.letterHeight,2.2);const css=c.textStyle({...clean,textEffect:"extrude"});assert.ok(css.textShadow.includes("px"));const html=await readFile(resolve(root,"public/video-studio.html"),"utf8");for(const id of ["textPreset","layerEffect","layerOutlineColor","layerOutlineWidth","layerTextAlign","layerLetterHeight"])assert.ok(html.includes('id="'+id+'"'));});

test("Creative typography presets persist across pages with safe CSS values",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [core,pages,editor]=await Promise.all(["public/creative-core.js","public/creative-pages.js","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 const ctx={crypto:{randomUUID:()=>"00000000-0000-4000-8000-000000000001"}};
 runInNewContext(core+"\n"+pages,ctx);
 const engine=ctx.ALEGON_CREATIVE_CORE,manager=ctx.ALEGON_CREATIVE_PAGES;
 for(const name of ["editorial","impact","neon","classic","minimal"]){
  const preset=engine.preset(name);
  assert.ok(preset&&typeof preset.font==="string");
  const layer=engine.layer({...preset,id:"abcdefgh",kind:"text",text:"ALEGON"});
  const css=engine.textStyle(layer);
  assert.ok(css.fontSize&&css.fontFamily);
  const doc=manager.documentModel({pages:[{layers:[layer],canvasFormat:"post"}]});
  assert.equal(doc.pages[0].layers[0].font,layer.font);
  assert.equal(doc.pages[0].layers[0].textEffect,layer.textEffect);
 }
 const rejected=engine.layer({id:"abcdefgh",kind:"text",textEffect:"url(javascript:alert(1))",outlineColor:"red;position:fixed",textAlign:"justify"});
 assert.equal(rejected.textEffect,"none");
 assert.equal(rejected.outlineColor,"#ffffff");
 assert.equal(rejected.textAlign,"left");
 assert.match(editor,/id="textPreset"/);assert.match(editor,/id="layerEffect"/);
 assert.match(editor,/textStyle\(l\)/);
});

test("Creative groups preserve multi-selection and clamp joint movement",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [code,core,editor]=await Promise.all(["public/creative-groups.js","public/creative-core.js","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 const ctx={crypto:{randomUUID:()=> "12345678-1234-4234-8234-123456789012"}};
 runInNewContext(code,ctx);runInNewContext(core,ctx);
 const api=ctx.ALEGON_CREATIVE_GROUPS;
 const sample=[{id:"aaaa1111",x:10,y:10,width:20},{id:"bbbb2222",x:40,y:15,width:20}];
 const grouped=api.group(sample,["aaaa1111","bbbb2222"]);
 assert.ok(grouped.groupId);
 assert.equal(grouped.layers[0].groupId,grouped.layers[1].groupId);
 assert.deepEqual(Array.from(api.groupIds(grouped.layers,"aaaa1111")),["aaaa1111","bbbb2222"]);
 const moved=api.translate(grouped.layers,["aaaa1111","bbbb2222"],100,100);
 assert.equal(moved[1].x,80);assert.equal(moved[0].x,50);
 assert.equal(api.ungroup(grouped.layers,grouped.groupId)[0].groupId,"");
 assert.equal(ctx.ALEGON_CREATIVE_CORE.layer({...grouped.layers[0]}).groupId,grouped.groupId);
 for(const id of ["groupLayers","ungroupLayers","clearMultiSelection"])assert.ok(editor.includes('id="'+id+'"'));
});

test("Creative photo framing and filters persist safely between pages",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [image,core,pages,editor]=await Promise.all(["public/creative-image.js","public/creative-core.js","public/creative-pages.js","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 const context={crypto:{randomUUID:()=>"12345678-1234-4234-8234-123456789012"}};
 runInNewContext(image+"\n"+core+"\n"+pages,context);
 const filters=context.ALEGON_CREATIVE_IMAGE;
 const safe=filters.normalize({imageZoom:900,imageContrast:-5,imageBlur:999,imageMask:"unsafe"});
 assert.equal(safe.imageZoom,300);assert.equal(safe.imageContrast,30);assert.equal(safe.imageBlur,10);assert.equal(safe.imageMask,"square");
 const layer=context.ALEGON_CREATIVE_CORE.layer({id:"aaaabbbb",kind:"image",imageZoom:155,imageX:24,imageMask:"circle",imageBrightness:120});
 assert.equal(layer.imageZoom,155);assert.equal(layer.imageMask,"circle");
 const saved=context.ALEGON_CREATIVE_PAGES.documentModel({pages:[{layers:[layer],coverZoom:"160",coverContrast:"112"}]});
 assert.equal(saved.pages[0].layers[0].imageX,24);assert.equal(saved.pages[0].coverZoom,"160");
 for(const id of ["imageReplace","imageFit","imageZoom","imageContrast","imageMask","coverPositionX","coverPositionY"])assert.ok(editor.includes('id="'+id+'"'));
 assert.match(editor,/Object\.assign\(img\.style,window\.ALEGON_CREATIVE_IMAGE\.imageStyle\(l\)\)/);
});

test("ALEGON Criativo expands original assets and preserves safe template searches",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [icons,templates,page]=await Promise.all(["public/alegon-elements.js","public/creative-templates.js","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 const context={window:{}};
 runInNewContext(icons+"\n"+templates,context);
 const elements=context.window.ALEGON_ELEMENTS,catalog=context.window.ALEGON_DESIGN_TEMPLATES;
 assert.ok(elements.icons.length>=100);
 assert.ok(elements.search("instagram").length>0);
 assert.ok(elements.search("veterinário").length>0);
 assert.ok(catalog.all.length>=20);
 assert.ok(catalog.find("barbearia").some(t=>t.id==="barber"));
 assert.ok(catalog.find("promoção").length>0);
 for(const id of ["designSearch","designCategory","designResults","brandKitName","saveBrandKit","applyBrandKit","favoritesOnly"])assert.ok(page.includes('id="'+id+'"'));
 assert.match(page,/favoriteKey\(\)/);
 assert.match(page,/ALEGON_DESIGN_TEMPLATES/);
});

test("Creative brand and favorites cloud preferences have private, restricted persistence",async()=>{
 const [route,migration,deploy,editor]=await Promise.all(["app/api/creative-preferences/route.ts","drizzle/0006_creative_preferences.sql","scripts/deploy-cloudflare.mjs","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 assert.match(route,/requirePlan\(request,"pro"\)/);
 assert.match(route,/requireSameOrigin\(request\)/);
 assert.match(route,/readJsonObject\(request,16_384\)/);
 assert.match(route,/checkRateLimit\(request/);
 assert.match(route,/WHERE user_id=\?/);
 assert.match(route,/typeof b\.name!=="string"\|\|b\.name\.length>45/);
 assert.match(route,/\[\.\.\.new Set\(items\)\]/);
 assert.match(route,/if\(body\.brand!==undefined\)/);
 assert.match(route,/if\(body\.favorites!==undefined\)/);
 assert.match(migration,/user_id TEXT PRIMARY KEY REFERENCES radar_users\(id\)/);
 assert.match(deploy,/0006_creative_preferences\.sql/);
 assert.match(editor,/loadCloudPreferences\(\)/);
 assert.match(editor,/syncPreferences\(\{favorites:next\}\)/);
 assert.match(editor,/syncPreferences\(\{brand\}\)/);
});

test("Creative precision snaps to canvas, margin and peer guides without moving outside bounds",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [helper,editor,css,exporter]=await Promise.all(["public/creative-precision.js","public/video-studio.html","public/creative-editor-v3.css","public/creative-export.js"].map(p=>readFile(resolve(root,p),"utf8")));
 const context={window:{}};runInNewContext(helper,context);
 const {snap}=context.window.ALEGON_CREATIVE_PRECISION;
 const center=snap({x:26.1,y:49.2,width:45,height:0,threshold:2});
 assert.equal(center.x,27.5);assert.equal(center.guideX,50);assert.equal(center.y,50);
 const edge=snap({x:1,y:3,width:30,height:15,threshold:1.1});
 assert.equal(edge.x,0);assert.equal(edge.guideX,0);
 const margin=snap({x:4.4,y:35,width:25,threshold:1});
 assert.equal(margin.x,5);assert.equal(margin.kindX,"margin");
 const peer=snap({x:21.2,y:70,width:20,peers:[{x:20,y:10,width:30,height:20}],threshold:1.5});
 assert.equal(peer.x,20);assert.equal(peer.kindX,"peer");
 const bounded=snap({x:99,y:99,width:35,height:40,threshold:0});
 assert.equal(bounded.x,65);assert.equal(bounded.y,60);
 assert.match(editor,/creative-precision\.js/);
 for(const field of ["precisionX","precisionY","precisionW","precisionRotation","precisionGrid","precisionRulers","precisionMargins"])assert.ok(editor.includes(field));
 assert.match(editor,/ev\.altKey/);
 assert.match(editor,/data-editor-guide/);
 assert.match(editor,/const editorOnly=node/);
 assert.match(css,/precision-overlay/);
 assert.match(exporter,/\[data-editor-overlay\],\[data-editor-guide\]/);
});

test("Creative professional exports constrain quality/scale and make a consistent one-page PDF",async()=>{
 const {runInNewContext}=await import("node:vm");
 const [script,editor]=await Promise.all(["public/creative-export.js","public/video-studio.html"].map(p=>readFile(resolve(root,p),"utf8")));
 const context={Blob,TextEncoder,Uint8Array};runInNewContext(script,context);
 const api=context.ALEGON_CREATIVE_EXPORT;
 assert.equal(api.exportOptions({scale:5,quality:100}).scale,1);
 assert.equal(api.exportOptions({scale:2,quality:-1}).quality,.5);
 assert.equal(api.exportOptions({scale:2,quality:.86,transparent:true}).transparent,true);
 assert.equal(api.canvasSize("wide").width,1920);
 for(const name of ["png","jpeg","webp","svg","pdf","html"])assert.equal(typeof api[name],"function");
 const jpegBytes=Uint8Array.from([255,216,255,217]);
 const pdf=api.pdfFromJpeg(jpegBytes,1080,1920);
 assert.equal(pdf.type,"application/pdf");
 const bytes=new Uint8Array(await pdf.arrayBuffer());
 const doc=new TextDecoder("latin1").decode(bytes);
 assert.ok(doc.startsWith("%PDF-1.4"));
 assert.match(doc,/\/Subtype \/Image \/Width 1080 \/Height 1920/);
 assert.match(doc,/\/Filter \/DCTDecode \/Length 4/);
 assert.match(doc,/\/MediaBox \[0 0 810 1440\]/);
 const xrefOffset=Number(doc.match(/startxref\n(\d+)/)?.[1]);
 assert.ok(xrefOffset>0);assert.equal(doc.slice(xrefOffset,xrefOffset+4),"xref");
 for(const field of ["exportFormat","exportScale","exportQuality","exportTransparency","exportProfessional"])assert.ok(editor.includes('id="'+field+'"'));
 assert.match(script,/data-editor-overlay/);
 assert.match(script,/export-transparent/);
});
