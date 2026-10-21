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
 assert.match(page,/prefers-reduced-motion:reduce/);assert.match(studio,/href="\/video-studio\.html"/);
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
test("Global ALEGON library: D1 isolation and admin-only publishing",async()=>{const sql=await readFile(resolve(root,"drizzle/0001_alegon_library.sql"),"utf8"),api=await readFile(resolve(root,"app/api/library/route.ts"),"utf8");assert.match(sql,/alegon_library_templates/);assert.match(sql,/alegon_library_projects/);assert.match(api,/requireUser\(request\)/);assert.match(api,/requireSameOrigin\(request\)/);assert.match(api,/global&&!isAdmin\(user.email\)/);assert.match(api,/WHERE user_id=\?/);assert.match(api,/published=1/);});

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
