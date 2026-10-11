import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { syncTransferMarket } from "../lib/transfers/sync.ts";

try { loadEnvFile(".env.local"); } catch { /* CI supplies environment variables. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase 환경변수가 필요합니다.");
const year = process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1];
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
syncTransferMarket(client, { season: year ? Number(year) : undefined, scheduled: process.argv.includes("--scheduled") })
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error(error instanceof Error ? error.message : "동기화에 실패했습니다."); process.exitCode = 1; });
