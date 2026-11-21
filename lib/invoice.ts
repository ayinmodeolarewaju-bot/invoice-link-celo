import { createHmac, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import { textileMode } from "./chains";

export type InvoicePayload = {
  v: 1;
  clientName: string;
  description: string;
  amount: string;
  recipientName: string;
  recipient: Address;
  createdAt: string;
  outsideTeam: true;
};

export type InvoiceDraft = {
  clientName?: string;
  description?: string;
  amount?: string;
  recipientName?: string;
  recipient?: string;
  outsideTeam?: boolean;
};

const DEV_SECRET = "invoice-link-celo-development-secret";

export function signingMaterial(): { secret: string; development: boolean } {
  const secret = process.env.INVOICE_SIGNING_SECRET?.trim() ?? "";
  if (secret.length >= 16) return { secret, development: false };
  return { secret: DEV_SECRET, development: true };
}

export function canonicalInvoice(input: InvoiceDraft & { createdAt?: string }): InvoicePayload {
  const clientName = cleanName(input.clientName, 80, "Client name");
  const recipientName = cleanName(input.recipientName, 64, "Recipient name");
  const description = (input.description?.trim() || "Freelance services").slice(0, 280);
  if (!description) throw new Error("Add a short description.");
  const amount = normalizeAmount(input.amount);
  if (!input.recipient || !isAddress(input.recipient)) {
    throw new Error("Recipient address must be a 20-byte hex address.");
  }
  if (input.outsideTeam !== true) {
    throw new Error("Confirm the recipient is outside the team before creating the invoice.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    v: 1,
    clientName,
    description,
    amount,
    recipientName,
    recipient: getAddress(input.recipient),
    createdAt,
    outsideTeam: true,
  };
}

export function invoiceId(payload: InvoicePayload): Hex {
  return keccak256(toBytes(JSON.stringify(payload)));
}

export function signValue(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingMaterial().secret).update(body).digest("base64url");
  return `${body}~${sig}`;
}

export function readSigned<T>(token: string): T {
  const splitAt = token.lastIndexOf("~");
  if (splitAt <= 0) throw new Error("This link is not a valid invoice token.");
  const body = token.slice(0, splitAt);
  const sig = token.slice(splitAt + 1);
  const expected = createHmac("sha256", signingMaterial().secret).update(body).digest("base64url");
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    throw new Error("This link was signed with a different secret, or it was edited.");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

export function signInvoice(payload: InvoicePayload): string {
  return signValue(payload);
}

export function readInvoiceToken(token: string): InvoicePayload {
  const payload = readSigned<InvoicePayload>(token);
  return canonicalInvoice(payload);
}

export function normalizeAmount(raw: string | undefined): string {
  if (!raw) throw new Error("Enter an amount in USDT.");
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error("Amount must be a dollar figure with at most two decimal places.");
  }
  const [whole, frac = ""] = cleaned.split(".");
  const amount = `${whole}.${frac.padEnd(2, "0")}`;
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0.01) throw new Error("Amount must be at least 0.01 USDT.");
  if (value > 1_000_000) throw new Error("Amount is above the limit for this demo.");
  if (textileMode() === "celo" && value < 1) {
    throw new Error("Textile's RFQ floor on Celo is about $1. Use at least 1.00 USDT.");
  }
  return amount;
}

function cleanName(value: string | undefined, max: number, label: string): string {
  const name = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) throw new Error(`${label} is required.`);
  if (name.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return name;
}
