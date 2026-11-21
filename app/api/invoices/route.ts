import { errorMessage } from "@/lib/env";
import { canonicalInvoice, signInvoice } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Send a JSON invoice." }, { status: 400 });
  }
  try {
    const payload = canonicalInvoice({
      clientName: body.clientName,
      amount: body.amount,
      description: body.description,
      recipientName: body.recipientName,
      recipient: body.recipient,
      outsideTeam: body.outsideTeam === true,
    });
    const token = signInvoice(payload);
    return Response.json({ token, payUrl: `/i/${token}`, invoice: payload }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
