import { parseEventLogs } from "viem";
import { verifyTx } from "@celo/attribution-tags";
import { appOrigin, loadLocalEnv } from "../lib/env";
import { chainById, identityRegistry } from "../lib/chains";
import { identityRegisterAbi } from "../lib/erc8004";
import { assertMainnetConsent } from "../lib/mainnetGuard";
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
const registry = identityRegistry(chainId);
const agentURI = readFlag("--agent-uri") ?? `${appOrigin()}/agent.json`;
const wallet = getAgentWallet(chain);
const pub = getPublicClient(chain);

console.log(`Registering ${account.address} on ${chain.name} (${chain.id}).`);
console.log(`Identity Registry ${registry}`);
console.log(`agentURI ${agentURI}`);
console.log("This is the single event wallet. Do not register a second one.");

const hash = await wallet.writeContract({
  address: registry,
  abi: identityRegisterAbi,
  functionName: "register",
  args: [agentURI],
  chain,
});
const receipt = await pub.waitForTransactionReceipt({ hash });
const [registered] = parseEventLogs({
  abi: identityRegisterAbi,
  eventName: "Registered",
  logs: receipt.logs,
});
const tagged = await verifyTx({ client: pub, hash });
console.log(`tx ${hash}`);
console.log(`agentId ${registered?.args.agentId?.toString() ?? "not found in logs"}`);
console.log(`attribution ${tagged?.codes.join(",") || "MISSING"}`);
if (!tagged?.codes.includes(tag)) {
  console.error("The registration transaction does not carry the Loops tag.");
  process.exit(1);
}
console.log("Set ERC8004_AGENT_ID to the agent id above. Add this same address to the Loops entry.");

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}
