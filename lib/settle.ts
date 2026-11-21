import { verifyTx, fromDataSuffix, toDataSuffix } from "@celo/attribution-tags";
import {
  decodeFunctionData,
  encodeDeployData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  CELO_MAINNET_ID,
  corridorTokens,
  settlementChain,
  textileMode,
  txExplorerUrl,
} from "./chains";
import { invoiceId, type InvoicePayload } from "./invoice";
import { assertMainnetConsent } from "./mainnetGuard";
import { verifyUsdtPayment } from "./payment";
import { invoiceReceiptAbi } from "./receiptAbi";
import { obtainQuote, submitFill, type FirmQuote } from "./textile";
import { getAgentWallet, getPublicClient, requireAttributionTag } from "./wallet";

export type Settlement = {
  simulated: boolean;
  broadcast: boolean;
  textileMode: string;
  chainId: number;
  invoiceId: Hex;
  usdtIn: string;
  cngnOut: string;
  feeAmount: string;
  rateLabel: string;
  reactor: Address;
  attributionTag: string | null;
  attributionSuffix: Hex | null;
  attributionVerified: boolean;
  paymentTx: Hex | null;
  approvalTx: Hex | null;
  swapTx: Hex | null;
  payoutTx: Hex | null;
  rfqId: string | null;
  explorers: {
    payment: string | null;
    approval: string | null;
    swap: string | null;
    payout: string | null;
  };
  note: string;
};

export async function settleInvoice(input: {
  invoice: InvoicePayload;
  simulate?: boolean;
  paymentTx?: Hex;
  confirmMainnet?: boolean;
}): Promise<Settlement> {
  const mode = textileMode();
  if (input.simulate || mode === "mock") {
    if (input.simulate && mode !== "mock") {
      throw new Error("Simulated settlement is only available when TEXTILE_MODE=mock.");
    }
    if (!input.simulate && mode === "mock") {
      throw new Error("TEXTILE_MODE=mock does not broadcast. Send simulate: true to walk the corridor.");
    }
    return mockSettlement(input.invoice);
  }

  const chain = settlementChain();
  assertMainnetConsent(chain.id, input.confirmMainnet === true);
  const tag = requireAttributionTag();
  if (!input.paymentTx) throw new Error("Paste the client's USDT payment transaction hash.");
  const registryRaw = process.env.RECEIPT_REGISTRY?.trim() ?? "";
  if (!isAddress(registryRaw)) {
    throw new Error("Set RECEIPT_REGISTRY to the InvoiceReceipt deployed by the agent wallet. No transaction was sent.");
  }
  const registry = getAddress(registryRaw);

  const tokens = corridorTokens(chain.id);
  const usdtIn = parseUnits(input.invoice.amount, tokens.usdtDecimals);
  await verifyUsdtPayment({ chainId: chain.id, paymentTx: input.paymentTx, amount: usdtIn });

  let quote = await obtainQuote({ chainId: chain.id, sellAmount: usdtIn });
  const wallet = getAgentWallet(chain);
  const pub = getPublicClient(chain);
  const account = wallet.account;
  if (!account) throw new Error("Agent wallet has no account.");

  const approvalTx = await ensureAllowance({
    wallet,
    pub,
    token: tokens.usdt,
    owner: account.address,
    spender: quote.spender,
    required: quote.takerPays,
  });

  if (quote.expiresAt && Date.now() >= Date.parse(quote.expiresAt)) {
    quote = await obtainQuote({ chainId: chain.id, sellAmount: usdtIn });
  }
  if (quote.expiresAt && Date.now() >= Date.parse(quote.expiresAt)) {
    throw new Error("The Textile quote expired. Request was not broadcast.");
  }

  const swapHash = await wallet.sendTransaction({
    to: quote.swap.to,
    data: quote.swap.data,
    value: BigInt(quote.swap.value || "0"),
    chain,
  });
  const swapReceipt = await pub.waitForTransactionReceipt({ hash: swapHash });
  if (swapReceipt.status !== "success") throw new Error("The Textile swap reverted.");
  await assertTagged(pub, swapHash, tag);

  try {
    await submitFill(quote, swapHash);
  } catch {
    // Settlement is reconciled from the filled order. The hash is already on the receipt.
  }

  const cngnBalance = await pub.readContract({
    address: tokens.cngn,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (cngnBalance < quote.buyAmount) {
    throw new Error("The swap receipt succeeded but the agent cNGN balance is below the quoted buy amount. Payout was not sent.");
  }

  await ensureAllowance({
    wallet,
    pub,
    token: tokens.cngn,
    owner: account.address,
    spender: registry,
    required: quote.buyAmount,
  });

  const id = invoiceId(input.invoice);
  const payoutHash = await wallet.writeContract({
    address: registry,
    abi: invoiceReceiptAbi,
    functionName: "settle",
    args: [
      id,
      tokens.cngn,
      input.invoice.recipient,
      quote.buyAmount,
      usdtIn,
      input.paymentTx,
      swapHash,
      input.invoice.recipientName,
      input.invoice.clientName,
    ],
    chain,
  });
  const payoutReceipt = await pub.waitForTransactionReceipt({ hash: payoutHash });
  if (payoutReceipt.status !== "success") throw new Error("The cNGN payout reverted.");
  await assertTagged(pub, payoutHash, tag);

  return settlementFromQuote({
    invoice: input.invoice,
    quote,
    chainId: chain.id,
    tag,
    paymentTx: input.paymentTx,
    approvalTx,
    swapTx: swapHash,
    payoutTx: payoutHash,
    verified: true,
  });
}

export function money(value: bigint, decimals: number): string {
  const raw = formatUnits(value, decimals);
  const [whole, frac = ""] = raw.split(".");
  return `${whole}.${frac.slice(0, 2).padEnd(2, "0")}`;
}

export function mockSettlement(invoice: InvoicePayload): Settlement {
  const configured = process.env.ATTRIBUTION_TAG?.trim() ?? "";
  const valid = /^[a-z0-9_]{1,32}$/.test(configured);
  const suffix = valid ? toDataSuffix(configured) : null;
  const usdtIn = parseUnits(invoice.amount, 6);
  const cngnOut = usdtIn * 1500n;
  const fee = (usdtIn * 2n) / 10_000n;
  const chainId = settlementChain().id;
  return {
    simulated: true,
    broadcast: false,
    textileMode: "mock",
    chainId,
    invoiceId: invoiceId(invoice),
    usdtIn: money(usdtIn, 6),
    cngnOut: money(cngnOut, 6),
    feeAmount: money(fee, 6),
    rateLabel: "Illustrative mock rate of 1500 cNGN per USDT. Not a Textile quote.",
    reactor: corridorTokens(42220).reactor,
    attributionTag: valid ? configured : null,
    attributionSuffix: suffix,
    attributionVerified: false,
    paymentTx: null,
    approvalTx: null,
    swapTx: null,
    payoutTx: null,
    rfqId: null,
    explorers: { payment: null, approval: null, swap: null, payout: null },
    note: valid
      ? "No transaction was broadcast. Live sends are built in lib/wallet.ts, so the Loops tag is appended once for every transaction, including Textile swap data."
      : "No transaction was broadcast. ATTRIBUTION_TAG is unset, so a live send would be refused.",
  };
}

function settlementFromQuote(input: {
  invoice: InvoicePayload;
  quote: FirmQuote;
  chainId: number;
  tag: string;
  paymentTx: Hex;
  approvalTx: Hex | null;
  swapTx: Hex;
  payoutTx: Hex;
  verified: boolean;
}): Settlement {
  const tokens = corridorTokens(input.chainId);
  const link = (hash: Hex | null) => (hash ? txExplorerUrl(input.chainId, hash) : null);
  return {
    simulated: false,
    broadcast: true,
    textileMode: input.quote.mode,
    chainId: input.chainId,
    invoiceId: invoiceId(input.invoice),
    usdtIn: money(input.quote.sellAmount, tokens.usdtDecimals),
    cngnOut: money(input.quote.buyAmount, tokens.cngnDecimals),
    feeAmount: money(input.quote.feeAmount, tokens.usdtDecimals),
    rateLabel: input.quote.rateLabel,
    reactor: input.quote.reactor,
    attributionTag: input.tag,
    attributionSuffix: toDataSuffix(input.tag),
    attributionVerified: input.verified,
    paymentTx: input.paymentTx,
    approvalTx: input.approvalTx,
    swapTx: input.swapTx,
    payoutTx: input.payoutTx,
    rfqId: input.quote.rfqId,
    explorers: {
      payment: link(input.paymentTx),
      approval: link(input.approvalTx),
      swap: link(input.swapTx),
      payout: link(input.payoutTx),
    },
    note:
      input.chainId === CELO_MAINNET_ID
        ? "Settled on Celo mainnet. The payout transaction is the on-chain receipt and includes the cNGN transfer."
        : "Settled on the Textile sandbox. This chain is not the scored Celo mainnet corridor.",
  };
}

async function ensureAllowance(input: {
  wallet: ReturnType<typeof getAgentWallet>;
  pub: ReturnType<typeof getPublicClient>;
  token: Address;
  owner: Address;
  spender: Address;
  required: bigint;
}): Promise<Hex | null> {
  const allowance = await input.pub.readContract({
    address: input.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [input.owner, input.spender],
  });
  if (allowance >= input.required) return null;
  if (allowance > 0n) {
    const reset = await input.wallet.writeContract({
      address: input.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [input.spender, 0n],
      chain: input.wallet.chain,
    });
    await input.pub.waitForTransactionReceipt({ hash: reset });
  }
  const hash = await input.wallet.writeContract({
    address: input.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [input.spender, input.required],
    chain: input.wallet.chain,
  });
  const receipt = await input.pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Token approval reverted.");
  return hash;
}

async function assertTagged(
  client: ReturnType<typeof getPublicClient>,
  hash: Hex,
  tag: string,
) {
  const decoded = await verifyTx({ client, hash });
  if (!decoded?.codes.includes(tag)) {
    const offline = fromDataSuffix((await client.getTransaction({ hash })).input);
    if (!offline?.codes.includes(tag)) {
      throw new Error(
        `Transaction ${hash} does not carry ${tag}. Stopping before any further send.`,
      );
    }
  }
}

export function deploymentData(bytecode: Hex, agent: Address): Hex {
  return encodeDeployData({
    abi: invoiceReceiptAbi,
    bytecode,
    args: [agent],
  });
}

export function decodeApproveSpender(data: Hex): Address | null {
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data });
    if (decoded.functionName !== "approve") return null;
    return decoded.args[0];
  } catch {
    return null;
  }
}
