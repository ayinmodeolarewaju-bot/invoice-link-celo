import { fromDataSuffix } from "@celo/attribution-tags";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, describe, expect, it } from "vitest";
import { custom, parseTransaction, type Hex } from "viem";
import { celo } from "viem/chains";
import { AttributionRequiredError, createAttributedWallet, requireAttributionTag } from "./wallet";

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe("agent wallet", () => {
  it("refuses to build a mainnet client when the tag is missing", () => {
    delete process.env.ATTRIBUTION_TAG;
    let calls = 0;
    expect(() =>
      createAttributedWallet({
        account: privateKeyToAccount(generatePrivateKey()),
        chain: celo,
        transport: custom({
          async request() {
            calls += 1;
            throw new Error("should not send");
          },
        }),
      }),
    ).toThrow(AttributionRequiredError);
    expect(calls).toBe(0);
    expect(() => requireAttributionTag()).toThrow(/ATTRIBUTION_TAG/);
  });

  it("tags every send from the one wallet client", async () => {
    process.env.ATTRIBUTION_TAG = "celo_6a388b8aedfb";
    const sent: Hex[] = [];
    const wallet = createAttributedWallet({
      account: privateKeyToAccount(generatePrivateKey()),
      chain: celo,
      transport: custom({
        async request({ method, params }) {
          if (method === "eth_chainId") return "0xa4ec";
          if (method === "eth_estimateGas") return "0x5208";
          if (method === "eth_getTransactionCount") return "0x0";
          if (method === "eth_gasPrice") return "0x1";
          if (method === "eth_maxPriorityFeePerGas") return "0x1";
          if (method === "eth_feeHistory") {
            return { oldestBlock: "0x1", reward: [["0x1"]], baseFeePerGas: ["0x1", "0x1"], gasUsedRatio: [0.1] };
          }
          if (method === "eth_getBlockByNumber") {
            return {
              baseFeePerGas: "0x1",
              gasLimit: "0x1c9c380",
              number: "0x1",
              timestamp: "0x65",
              hash: `0x${"11".repeat(32)}`,
              parentHash: `0x${"22".repeat(32)}`,
              miner: `0x${"33".repeat(20)}`,
              difficulty: "0x0",
              nonce: "0x0000000000000000",
              extraData: "0x",
              transactions: [],
              size: "0x1",
              sha3Uncles: `0x${"00".repeat(32)}`,
              logsBloom: `0x${"00".repeat(256)}`,
              receiptsRoot: `0x${"00".repeat(32)}`,
              stateRoot: `0x${"00".repeat(32)}`,
              transactionsRoot: `0x${"00".repeat(32)}`,
              uncles: [],
              mixHash: `0x${"00".repeat(32)}`,
            };
          }
          if (method === "eth_sendRawTransaction") {
            const raw = (params as [Hex])[0];
            const tx = parseTransaction(raw);
            sent.push(tx.data ?? "0x");
            return `0x${"ab".repeat(32)}`;
          }
          throw new Error(`unexpected ${method}`);
        },
      }),
    });

    await wallet.sendTransaction({
      to: "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3",
      data: "0x1234",
      value: 0n,
    });
    await wallet.sendTransaction({
      to: "0x1111111111111111111111111111111111111111",
      value: 0n,
    });

    expect(sent).toHaveLength(2);
    for (const data of sent) {
      expect(fromDataSuffix(data)?.codes).toContain("celo_6a388b8aedfb");
    }
    expect(fromDataSuffix(sent[0])?.codes.filter((code) => code === "celo_6a388b8aedfb")).toHaveLength(1);
  });
});
