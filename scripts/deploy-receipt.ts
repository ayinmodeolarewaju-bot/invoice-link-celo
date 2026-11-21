import { verifyTx } from "@celo/attribution-tags";
import { loadLocalEnv } from "../lib/env";
import { chainById } from "../lib/chains";
import { compileReceipt } from "../lib/compileReceipt";
import { assertMainnetConsent } from "../lib/mainnetGuard";
import { deploymentData } from "../lib/settle";
import { getAgentWallet, getPublicClient, requireAgentAccount, requireAttributionTag } from "../lib/wallet";

loadLocalEnv();

const chainName = readFlag("--chain") ?? "celo-sepolia";
const chainId = chainName === "celo" ? 42220 : chainName === "celo-sepolia" ? 11142220 : null;
if (!chainId) {
  console.error("Use --chain celo-sepolia or --chain celo.");
  process.exit(1);
}

assertMainnetConsent(chainId, process.argv.includes("--confirm-mainnet"));
const tag = requireAttributionTag();
const account = requireAgentAccount();
const chain = chainById(chainId);
const compiled = compileReceipt();
const data = deploymentData(compiled.bytecode, account.address);
const wallet = getAgentWallet(chain);
const pub = getPublicClient(chain);

console.log(`Deploying InvoiceReceipt from ${account.address} on ${chain.name}.`);
console.log("The contract agent is this same wallet.");

const hash = await wallet.sendTransaction({ data, chain });
const receipt = await pub.waitForTransactionReceipt({ hash });
const tagged = await verifyTx({ client: pub, hash });
if (!receipt.contractAddress) {
  console.error("Deployment did not return a contract address.");
  process.exit(1);
}
console.log(`tx ${hash}`);
console.log(`RECEIPT_REGISTRY=${receipt.contractAddress}`);
console.log(`attribution ${tagged?.codes.join(",") || "MISSING"}`);
if (!tagged?.codes.includes(tag)) {
  console.error("The deploy transaction does not carry the Loops tag.");
  process.exit(1);
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}
