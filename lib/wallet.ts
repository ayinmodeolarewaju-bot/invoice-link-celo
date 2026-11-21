import { withAttribution } from "@celo/attribution-tags";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CELO_MAINNET_ID, PUBLIC_ATTRIBUTION_TAG, rpcUrl } from "./chains";

export class AttributionRequiredError extends Error {
  readonly code = "ATTRIBUTION_REQUIRED";
}

const TAG_RE = /^[a-z0-9_]{1,32}$/;

/**
 * The only place a wallet client is built.
 * withAttribution tags every sendTransaction and writeContract on that client.
 * Contract creation goes through sendTransaction on this same client.
 */
export function requireAttributionTag(): string {
  const tag = process.env.ATTRIBUTION_TAG?.trim() ?? "";
  if (!tag) {
    throw new AttributionRequiredError(
      `Refusing to send: ATTRIBUTION_TAG is not set. This entry's public tag is ${PUBLIC_ATTRIBUTION_TAG}. Set it before any transaction is built.`,
    );
  }
  if (!TAG_RE.test(tag)) {
    throw new AttributionRequiredError(
      "Refusing to send: ATTRIBUTION_TAG must match [a-z0-9_]{1,32}.",
    );
  }
  return tag;
}

export function attributionStatus(): { configured: boolean; tag: string | null } {
  const tag = process.env.ATTRIBUTION_TAG?.trim() ?? "";
  if (!tag || !TAG_RE.test(tag)) return { configured: false, tag: null };
  return { configured: true, tag };
}

/** The single event wallet. Registration, swaps, and payouts all use this key. */
export function requireAgentAccount(): Account {
  const raw = process.env.AGENT_PRIVATE_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not set. This event uses one agent wallet. Put that key in the environment. Do not create a second wallet.",
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex key. The value was rejected and was not logged.");
  }
  return privateKeyToAccount(raw as `0x${string}`);
}

export function tryAgentAddress(): `0x${string}` | null {
  try {
    return requireAgentAccount().address;
  } catch {
    return null;
  }
}

export function createAttributedWallet<chain extends Chain, transport extends Transport>(opts: {
  account: Account;
  chain: chain;
  transport: transport;
}) {
  const tag = requireAttributionTag();
  if (opts.chain.id === CELO_MAINNET_ID && tag !== process.env.ATTRIBUTION_TAG?.trim()) {
    throw new AttributionRequiredError("Refusing to send on Celo mainnet without ATTRIBUTION_TAG.");
  }
  return createWalletClient({
    account: opts.account,
    chain: opts.chain,
    transport: opts.transport,
  }).extend(withAttribution(tag));
}

export function getAgentWallet(chain: Chain) {
  return createAttributedWallet({
    account: requireAgentAccount(),
    chain,
    transport: http(rpcUrl(chain.id)),
  });
}

export function getPublicClient(chain: Chain): PublicClient {
  return createPublicClient({
    chain,
    transport: http(rpcUrl(chain.id)),
  });
}
