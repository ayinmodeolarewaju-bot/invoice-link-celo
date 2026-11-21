import { decodeEventLog, erc20Abi, type Address, type Hex } from "viem";
import { corridorTokens } from "./chains";
import { getPublicClient, tryAgentAddress } from "./wallet";
import { chainById } from "./chains";

export async function verifyUsdtPayment(input: {
  chainId: number;
  paymentTx: Hex;
  amount: bigint;
}): Promise<{ from: Address; value: bigint }> {
  const agent = tryAgentAddress();
  if (!agent) {
    throw new Error("AGENT_PRIVATE_KEY is not set, so there is no agent address to pay.");
  }
  const tokens = corridorTokens(input.chainId);
  const client = getPublicClient(chainById(input.chainId));
  const receipt = await client.getTransactionReceipt({ hash: input.paymentTx });
  if (receipt.status !== "success") {
    throw new Error("The payment transaction reverted.");
  }
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokens.usdt.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const to = decoded.args.to;
      const value = decoded.args.value;
      if (to.toLowerCase() === agent.toLowerCase() && value === input.amount) {
        return { from: decoded.args.from, value };
      }
    } catch {
      continue;
    }
  }
  throw new Error("No USDT transfer of the invoice amount to the agent wallet was found in that transaction.");
}
