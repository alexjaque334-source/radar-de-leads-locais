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
    "app/api/auth/me/route.ts", "app/api/tomtom-search/route.ts", "app/api/crm/leads/route.ts",
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

test("TomTom results are not eligible for persisted CRM export", async () => {
  const radar = await readFile(resolve(root,"public/radar.html"),"utf8");
  const crm = await readFile(resolve(root,"app/api/crm/leads/route.ts"),"utf8");
  assert.match(radar,/exportable:false,food:FOOD\.has\(cat\)/);
  assert.match(crm,/lead\.source !== "OpenStreetMap"/);
  assert.match(crm,/CRM só armazena registros públicos verificáveis do OpenStreetMap/);
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

test("CRM compliance gate: five checks",async()=>{const crm=await readFile(resolve(root,"public/crm.html"),"utf8");const radar=await readFile(resolve(root,"public/radar.html"),"utf8");const studio=await readFile(resolve(root,"public/studio.html"),"utf8");const api=await readFile(resolve(root,"app/api/crm/leads/route.ts"),"utf8");assert.match(crm,/CRM desativado/);assert.match(crm,/location\.replace\("\/radar\.html"\)/);assert.doesNotMatch(radar,/href="\/crm\.html"/);assert.doesNotMatch(studio,/href="\/crm\.html"/);assert.match(api,/lead\.source !== "OpenStreetMap"/);});

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
