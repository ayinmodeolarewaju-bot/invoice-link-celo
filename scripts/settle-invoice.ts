import { loadLocalEnv } from "../lib/env";
import { readInvoiceToken } from "../lib/invoice";
import { settleInvoice } from "../lib/settle";
import type { Hex } from "viem";

loadLocalEnv();

const token = readFlag("--token");
const paymentTx = readFlag("--payment-tx") as Hex | undefined;
if (!token) {
  console.error("Usage: npm run settle -- --token <invoiceToken> --payment-tx 0x... [--confirm-mainnet]");
  process.exit(1);
}

const invoice = readInvoiceToken(token);
const settlement = await settleInvoice({
  invoice,
  paymentTx,
  simulate: process.argv.includes("--simulate"),
  confirmMainnet: process.argv.includes("--confirm-mainnet"),
});
console.log(JSON.stringify(settlement, null, 2));

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}
