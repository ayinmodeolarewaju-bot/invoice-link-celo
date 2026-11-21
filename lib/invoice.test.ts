import { afterEach, describe, expect, it } from "vitest";
import { canonicalInvoice, invoiceId, readInvoiceToken, signInvoice } from "./invoice";
import { parseUtterance } from "./parse";
import { mockSettlement, settleInvoice } from "./settle";

const base = {
  clientName: "Acme",
  description: "Logo",
  amount: "50",
  recipientName: "Ada",
  recipient: "0x1111111111111111111111111111111111111111",
  outsideTeam: true as const,
  createdAt: "2026-11-20T12:00:00.000Z",
};

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe("invoices", () => {
  it("parses a payout sentence and asks for the missing address", () => {
    const parsed = parseUtterance("invoice Acme $50, pay out to Ada in naira");
    expect(parsed.draft.clientName).toBe("Acme");
    expect(parsed.draft.amount).toBe("50");
    expect(parsed.draft.recipientName).toBe("Ada");
    expect(parsed.missing).toContain("recipient");
    expect(parsed.missing).toContain("outsideTeam");
    expect(parsed.question).toMatch(/Ada/);
  });

  it("parses a complete sentence with a description", () => {
    const parsed = parseUtterance(
      "bill Design Co $120 for the logo, send naira to Ada at 0x2222222222222222222222222222222222222222",
    );
    expect(parsed.draft.clientName).toBe("Design Co");
    expect(parsed.draft.amount).toBe("120");
    expect(parsed.draft.description).toBe("the logo");
    expect(parsed.draft.recipientName).toBe("Ada");
    expect(parsed.draft.recipient).toBe("0x2222222222222222222222222222222222222222");
  });

  it("signs a token and rejects a tampered copy", () => {
    const payload = canonicalInvoice(base);
    const token = signInvoice(payload);
    expect(readInvoiceToken(token).clientName).toBe("Acme");
    expect(readInvoiceToken(token).amount).toBe("50.00");
    const tampered = `${token.slice(0, 8)}A${token.slice(9)}`;
    expect(() => readInvoiceToken(tampered)).toThrow(/secret|edited|valid/i);
    expect(invoiceId(payload)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("refuses an invoice that does not name an outside recipient", () => {
    expect(() => canonicalInvoice({ ...base, outsideTeam: false as unknown as true })).toThrow(/outside the team/);
  });

  it("simulates settlement without broadcasting and shows the public tag", () => {
    process.env.TEXTILE_MODE = "mock";
    process.env.ATTRIBUTION_TAG = "celo_6a388b8aedfb";
    const settlement = mockSettlement(canonicalInvoice(base));
    expect(settlement.broadcast).toBe(false);
    expect(settlement.simulated).toBe(true);
    expect(settlement.paymentTx).toBeNull();
    expect(settlement.swapTx).toBeNull();
    expect(settlement.attributionTag).toBe("celo_6a388b8aedfb");
    expect(settlement.attributionSuffix).toMatch(/^0x/);
    expect(settlement.cngnOut).toBe("75000.00");
  });

  it("refuses a live Celo settlement without explicit consent", async () => {
    process.env.TEXTILE_MODE = "celo";
    process.env.ATTRIBUTION_TAG = "celo_6a388b8aedfb";
    await expect(
      settleInvoice({
        invoice: canonicalInvoice({ ...base, amount: "1.00" }),
        paymentTx: `0x${"ab".repeat(32)}`,
        confirmMainnet: false,
      }),
    ).rejects.toThrow(/mainnet/i);
  });
});
