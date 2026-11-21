import { isAddress } from "viem";
import type { InvoiceDraft } from "./invoice";

export type ParseResult = {
  draft: InvoiceDraft;
  missing: string[];
  question: string | null;
};

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/;

export function parseUtterance(message: string): ParseResult {
  const original = message.trim();
  let text = original.replace(/\s+/g, " ");
  const draft: InvoiceDraft = {};

  const address = text.match(ADDRESS_RE)?.[0];
  if (address && isAddress(address)) {
    draft.recipient = address;
    text = text.replace(address, " ").replace(/\bat\b/i, " ");
  }

  const dollar = text.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
  const worded = text.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:usdt|usd|dollars)\b/i);
  const amountRaw = dollar?.[1] ?? worded?.[1];
  if (amountRaw) draft.amount = amountRaw.replace(/,/g, "");

  const recipient = text.match(
    /(?:pay out to|payout to|pay to|send naira to|send to)\s+([A-Za-z][A-Za-z' .-]{0,60}?)(?=\s+in\b|\s+at\b|,|$)/i,
  );
  if (recipient?.[1]) {
    draft.recipientName = recipient[1].replace(/\bin naira\b/i, "").trim();
  }

  const client = text.match(/^(?:please\s+)?(?:invoice|bill)\s+(.+?)(?=\s+\$|\s+[0-9]|\s+for\b|,|$)/i);
  if (client?.[1]) draft.clientName = client[1].trim();

  const description = text.match(/\bfor\s+(.+?)(?=,|$)/i);
  if (description?.[1] && !/^\$/.test(description[1]) && !/^ada\b/i.test(description[1])) {
    const desc = description[1].trim();
    if (!/^(?:naira|usdt|usd)\b/i.test(desc)) draft.description = desc;
  }

  if (/\boutside (?:the |my )?team\b/i.test(original)) draft.outsideTeam = true;

  const missing: string[] = [];
  if (!draft.clientName) missing.push("clientName");
  if (!draft.amount) missing.push("amount");
  if (!draft.recipientName) missing.push("recipientName");
  if (!draft.recipient) missing.push("recipient");
  if (draft.outsideTeam !== true) missing.push("outsideTeam");

  let question: string | null = null;
  if (missing.includes("recipient") && draft.recipientName) {
    question = `What Celo address should receive cNGN for ${draft.recipientName}?`;
  } else if (missing.includes("outsideTeam") && draft.recipientName) {
    question = `Confirm that ${draft.recipientName} is outside the team, then send outsideTeam: true.`;
  } else if (missing.length > 0) {
    question = "Say who to invoice, the USDT amount, who receives naira, and their address.";
  }

  return { draft, missing, question };
}
