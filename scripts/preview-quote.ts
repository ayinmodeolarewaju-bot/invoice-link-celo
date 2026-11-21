import { previewCeloUsdtToCngn } from "../lib/textile";
import { loadLocalEnv } from "../lib/env";

loadLocalEnv();

const result = await previewCeloUsdtToCngn();
console.log(JSON.stringify({ status: result.status, body: result.json }, null, 2));
console.log("Read-only Textile preview for 1 USDT → cNGN on Celo. No transaction was sent.");
if (result.status >= 500) process.exit(1);
