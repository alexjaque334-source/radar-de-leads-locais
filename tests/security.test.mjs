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
