import { errorMessage } from "@/lib/env";
import { canonicalInvoice, signInvoice, type InvoiceDraft } from "@/lib/invoice";
import { missingFields, parseUtterance } from "@/lib/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = typeof body.message === "string" ? parseUtterance(body.message) : null;
  const draft: InvoiceDraft = {
    ...(parsed?.draft ?? {}),
    clientName: body.clientName ?? parsed?.draft.clientName,
    amount: body.amount ?? parsed?.draft.amount,
    description: body.description ?? parsed?.draft.description,
    recipientName: body.recipientName ?? parsed?.draft.recipientName,
    recipient: body.recipient ?? parsed?.draft.recipient,
    outsideTeam: body.outsideTeam === true || parsed?.draft.outsideTeam === true,
  };
  const missing = missingFields(draft);
  if (missing.length > 0) {
    return Response.json(
      {
        created: false,
        draft,
        missing,
        question: parsed?.question ?? "Add the missing invoice fields.",
      },
      { status: 422 },
    );
  }

  try {
    const payload = canonicalInvoice({ ...draft, outsideTeam: true });
    const token = signInvoice(payload);
    return Response.json(
      {
        created: true,
        token,
        payUrl: `/i/${token}`,
        invoice: payload,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }
}
