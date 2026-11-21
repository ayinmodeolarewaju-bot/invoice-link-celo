import { encodeFunctionData, type Address, type Hex } from "viem";
import { corridorTokens, textileMode, type TextileMode } from "./chains";
import { requireAgentAccount } from "./wallet";

const API = "https://api.textilecredit.com/v2";

export type PreparedTx = {
  to: Address;
  data: Hex;
  value: string;
  chainId: number;
};

export type FirmQuote = {
  simulated: boolean;
  mode: TextileMode;
  rfqId: string | null;
  claimToken: string | null;
  sellAmount: bigint;
  buyAmount: bigint;
  takerPays: bigint;
  feeAmount: bigint;
  rateLabel: string;
  expiresAt: string | null;
  reactor: Address;
  spender: Address;
  approval: PreparedTx | null;
  swap: PreparedTx;
};

const executeBatchAbi = [
  {
    type: "function",
    name: "executeBatch",
    stateMutability: "payable",
    inputs: [
      { name: "orders", type: "bytes[]" },
      { name: "signatures", type: "bytes[]" },
    ],
    outputs: [],
  },
] as const;

/** Body for POST /v2/rfq/request. includeAttribution stays false so the Loops tag is the only suffix. */
export function buildRfqBody(input: {
  chainId: number;
  sellToken: Address;
  buyToken: Address;
  sellAmount: bigint;
  taker: Address;
  takerProof?: { nonce: Hex; issuedAt: number; signature: Hex };
}): Record<string, unknown> {
  return {
    chainId: input.chainId,
    sellToken: input.sellToken,
    buyToken: input.buyToken,
    sellAmount: input.sellAmount.toString(),
    taker: input.taker,
    includeAttribution: false,
    ...(input.takerProof ? { takerProof: input.takerProof } : {}),
  };
}

export async function obtainQuote(input: {
  chainId: number;
  sellAmount: bigint;
}): Promise<FirmQuote> {
  const mode = textileMode();
  if (mode === "mock") return mockQuote(input.chainId, input.sellAmount);
  return liveQuote(input.chainId, input.sellAmount);
}

export function mockQuote(chainId: number, sellAmount: bigint): FirmQuote {
  const tokens =
    chainId === 97
      ? corridorTokens(97)
      : corridorTokens(42220);
  const buyAmount = sellAmount * 1500n;
  const feeAmount = (sellAmount * 2n) / 10_000n;
  const swapData = encodeFunctionData({
    abi: executeBatchAbi,
    functionName: "executeBatch",
    args: [["0x"], ["0x"]],
  });
  return {
    simulated: true,
    mode: "mock",
    rfqId: null,
    claimToken: null,
    sellAmount,
    buyAmount,
    takerPays: sellAmount,
    feeAmount,
    rateLabel: "Illustrative mock rate of 1500 cNGN per USDT. Not a Textile quote.",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    reactor: tokens.reactor,
    spender: tokens.reactor,
    approval: {
      to: tokens.usdt,
      data: "0x",
      value: "0",
      chainId,
    },
    swap: {
      to: tokens.reactor,
      data: swapData,
      value: "0",
      chainId,
    },
  };
}

async function liveQuote(chainId: number, sellAmount: bigint): Promise<FirmQuote> {
  const tokens = corridorTokens(chainId);
  const account = requireAgentAccount();
  const apiKey = process.env.TEXTILE_API_KEY?.trim() || "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const send = (takerProof?: { nonce: Hex; issuedAt: number; signature: Hex }) =>
    fetch(`${API}/rfq/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(
        buildRfqBody({
          chainId,
          sellToken: tokens.usdt,
          buyToken: tokens.cngn,
          sellAmount,
          taker: account.address,
          takerProof,
        }),
      ),
      signal: AbortSignal.timeout(75_000),
    });

  let response = await send();
  if (response.status === 401 && !apiKey) {
    const body = (await response.json().catch(() => null)) as {
      error?: { details?: { reason?: string } };
    } | null;
    if (body?.error?.details?.reason === "proof_of_control_required") {
      const takerProof = await signTakerControl(account, chainId);
      response = await send(takerProof);
    }
  }

  const json = (await response.json().catch(() => null)) as RfqResponse | null;
  if (!response.ok || !json?.data) {
    throw new Error(`Textile quote failed (${response.status}). No transaction was sent.`);
  }
  if (json.data.status === "no_quote") {
    throw new Error(
      `Textile returned no quote (${json.data.reason ?? "no_valid_quote"}). No transaction was sent.`,
    );
  }
  const quote = json.data.quote;
  const swap = json.data.transactions?.swap;
  if (!quote || !swap?.to || !swap.data) {
    throw new Error("Textile quote did not include a swap transaction. No transaction was sent.");
  }
  if (Number(swap.chainId) !== chainId) {
    throw new Error("Textile swap chain does not match the settlement chain. No transaction was sent.");
  }

  const spender = spenderFromApproval(json.data.transactions?.approval?.data, quote.reactor as Address);
  return {
    simulated: false,
    mode: textileMode(),
    rfqId: json.data.rfqId ?? null,
    claimToken: json.data.claimToken ?? null,
    sellAmount: BigInt(quote.sellAmount),
    buyAmount: BigInt(quote.buyAmount),
    takerPays: BigInt(quote.takerPays),
    feeAmount: BigInt(quote.feeAmount ?? "0"),
    rateLabel: "Textile firm quote",
    expiresAt: quote.expiresAt ?? null,
    reactor: quote.reactor as Address,
    spender,
    approval: json.data.transactions?.approval
      ? {
          to: json.data.transactions.approval.to as Address,
          data: json.data.transactions.approval.data as Hex,
          value: json.data.transactions.approval.value ?? "0",
          chainId,
        }
      : null,
    swap: {
      to: swap.to as Address,
      data: swap.data as Hex,
      value: swap.value ?? "0",
      chainId,
    },
  };
}

export async function submitFill(quote: FirmQuote, txHash: Hex) {
  if (!quote.rfqId || quote.simulated) return;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = process.env.TEXTILE_API_KEY?.trim() || "";
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  else if (quote.claimToken) headers["X-Rfq-Claim"] = quote.claimToken;
  const response = await fetch(`${API}/rfq/${quote.rfqId}/submit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ txHash }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Textile submit returned ${response.status}. The swap transaction itself is separate.`);
  }
}

export async function previewCeloUsdtToCngn(sellAmount = 1_000_000n) {
  const tokens = corridorTokens(42220);
  const response = await fetch(`${API}/rfq/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chainId: 42220,
      sellToken: tokens.usdt,
      buyToken: tokens.cngn,
      sellAmount: sellAmount.toString(),
      includeAttribution: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function signTakerControl(
  account: ReturnType<typeof requireAgentAccount>,
  chainId: number,
): Promise<{ nonce: Hex; issuedAt: number; signature: Hex }> {
  const { randomBytes } = await import("node:crypto");
  const { toHex } = await import("viem");
  const nonce = toHex(randomBytes(32));
  const issuedAt = Date.now();
  const signature = await account.signTypedData({
    domain: { name: "Textile Taker Control", version: "1", chainId },
    types: {
      TakerControl: [
        { name: "taker", type: "address" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "issuedAt", type: "uint256" },
      ],
    },
    primaryType: "TakerControl",
    message: {
      taker: account.address,
      chainId: BigInt(chainId),
      nonce,
      issuedAt: BigInt(issuedAt),
    },
  });
  return { nonce, issuedAt, signature };
}

function spenderFromApproval(data: string | undefined, reactor: Address): Address {
  if (!data || !data.startsWith("0x095ea7b3") || data.length < 10 + 64) return reactor;
  const spender = `0x${data.slice(10 + 24, 10 + 64)}` as Address;
  return spender;
}

type RfqResponse = {
  data?: {
    status?: string;
    reason?: string;
    rfqId?: string;
    claimToken?: string;
    quote?: {
      sellAmount: string;
      buyAmount: string;
      takerPays: string;
      feeAmount?: string;
      expiresAt?: string;
      reactor: string;
    };
    transactions?: {
      approval?: { to: string; data: string; value?: string; chainId?: number };
      swap?: { to: string; data: string; value?: string; chainId?: number };
    };
  };
};
