import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "radar-leads-locais";
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || "004f77e4-ed92-47e4-a4ae-1dc8e83df216";

if (!/^[a-f0-9-]{36}$/i.test(databaseId) || databaseId === "00000000-0000-4000-8000-000000000000") {
  console.error("Configure CLOUDFLARE_D1_DATABASE_ID com o UUID do D1 criado na sua conta Cloudflare.");
  process.exit(1);
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["scripts/run-framework.mjs", "build"]);
const wrangler = "node_modules/wrangler/bin/wrangler.js";
run([wrangler, "d1", "execute", databaseName, "--remote", "--file", "drizzle/0000_tense_vengeance.sql", "--config", "dist/server/wrangler.json"]);
run([wrangler, "deploy", "--config", "dist/server/wrangler.json"]);
