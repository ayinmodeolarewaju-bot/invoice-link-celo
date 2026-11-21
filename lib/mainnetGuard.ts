import { CELO_MAINNET_ID } from "./chains";

export class MainnetConsentError extends Error {
  readonly code = "MAINNET_CONSENT_REQUIRED";
}

/** Scripts must pass --confirm-mainnet. The HTTP settle route must pass confirmMainnet: true. */
export function assertMainnetConsent(chainId: number, confirmed: boolean) {
  if (chainId !== CELO_MAINNET_ID) return;
  if (confirmed) return;
  throw new MainnetConsentError(
    "Refusing Celo mainnet (chain 42220). Re-run with --confirm-mainnet, or send confirmMainnet: true from the pay page, after MAINNET_RUNBOOK.md. No mainnet transaction was sent.",
  );
}
