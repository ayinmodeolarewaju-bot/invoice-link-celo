import { createPublicClient, http } from "viem";
import { celo, celoSepolia } from "viem/chains";
import { identityRegistry, rpcUrl } from "../lib/chains";
import { loadLocalEnv } from "../lib/env";

loadLocalEnv();

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
const targets = [
  { chain: celo, label: "Celo mainnet" },
  { chain: celoSepolia, label: "Celo Sepolia" },
];

let failed = false;
for (const target of targets) {
  const address = identityRegistry(target.chain.id);
  const client = createPublicClient({ chain: target.chain, transport: http(rpcUrl(target.chain.id)) });
  try {
    const code = await client.getCode({ address });
    const bytes = code && code !== "0x" ? (code.length - 2) / 2 : 0;
    console.log(`${target.label} Identity Registry ${address}: ${bytes} bytes`);
    if (bytes === 0) failed = true;
  } catch (error) {
    failed = true;
    console.error(`${target.label} lookup failed: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

if (failed) process.exit(1);
console.log("Read-only check. No transaction was sent.");
}
