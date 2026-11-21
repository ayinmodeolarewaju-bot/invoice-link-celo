import {
  appChain,
  PUBLIC_ATTRIBUTION_TAG,
  settlementChain,
  textileMode,
} from "./chains";
import { signingMaterial } from "./invoice";
import { attributionStatus, tryAgentAddress } from "./wallet";

export function publicStatus() {
  const attribution = attributionStatus();
  const agentAddress = tryAgentAddress();
  const settlement = settlementChain();
  const app = appChain();
  return {
    ok: true,
    textileMode: textileMode(),
    appChainId: app.id,
    appChainName: app.name,
    settlementChainId: settlement.id,
    settlementChainName: settlement.name,
    attribution,
    expectedTag: PUBLIC_ATTRIBUTION_TAG,
    agentAddress,
    signingSecret: signingMaterial().development ? "development" : "set",
    receiptRegistry: process.env.RECEIPT_REGISTRY?.trim() || null,
    simulate: textileMode() === "mock",
  };
}
