import { AttributionRequiredError } from "@/lib/wallet";
import { errorMessage } from "@/lib/env";
import { readInvoiceToken, signValue } from "@/lib/invoice";
import { MainnetConsentError } from "@/lib/mainnetGuard";
import { settleInvoice } from "@/lib/settle";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  let invoice;
  try {
    invoice = readInvoiceToken(decodeURIComponent(token));
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const settlement = await settleInvoice({
      invoice,
      simulate: body.simulate === true,
      paymentTx: typeof body.paymentTx === "string" ? (body.paymentTx as Hex) : undefined,
      confirmMainnet: body.confirmMainnet === true,
    });
    const receiptToken = signValue({ invoice, settlement });
    return Response.json({ receiptUrl: `/r/${receiptToken}`, settlement });
  } catch (error) {
    const status = error instanceof AttributionRequiredError || error instanceof MainnetConsentError ? 403 : 400;
    return Response.json({ error: errorMessage(error) }, { status });
  }
}
