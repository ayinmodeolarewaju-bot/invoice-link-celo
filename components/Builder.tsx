"use client";

import { useMemo, useState } from "react";
import { parseUtterance } from "@/lib/parse";

type Created = { payUrl: string; invoice: { clientName: string; amount: string; recipientName: string } };

export function Builder() {
  const [sentence, setSentence] = useState("invoice Acme $50, pay out to Ada in naira");
  const [clientName, setClientName] = useState("Acme");
  const [amount, setAmount] = useState("50.00");
  const [description, setDescription] = useState("Freelance services");
  const [recipientName, setRecipientName] = useState("Ada");
  const [recipient, setRecipient] = useState("");
  const [outsideTeam, setOutsideTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const parsed = useMemo(() => parseUtterance(sentence), [sentence]);

  function applySentence() {
    const draft = parsed.draft;
    if (draft.clientName) setClientName(draft.clientName);
    if (draft.amount) setAmount(draft.amount);
    if (draft.description) setDescription(draft.description);
    if (draft.recipientName) setRecipientName(draft.recipientName);
    if (draft.recipient) setRecipient(draft.recipient);
    if (draft.outsideTeam) setOutsideTeam(true);
    setError(parsed.question);
  }

  async function createInvoice() {
    setPending(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName,
          amount,
          description,
          recipientName,
          recipient,
          outsideTeam,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create the invoice.");
      const origin = window.location.origin;
      setCreated({
        payUrl: `${origin}${body.payUrl}`,
        invoice: body.invoice,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invoice.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="builder-title">
      <h2 id="builder-title" style={{ marginTop: 0 }}>Write the invoice</h2>
      <label className="wide">
        Say it in a sentence
        <textarea
          value={sentence}
          onChange={(event) => setSentence(event.target.value)}
          aria-describedby="sentence-help"
        />
      </label>
      <p id="sentence-help" className="note">
        Example: invoice Acme $50, pay out to Ada in naira at 0x… Add the address when you have it.
      </p>
      <div className="actions">
        <button type="button" className="secondary" onClick={applySentence}>
          Fill the form from this sentence
        </button>
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        <label>
          Client
          <input value={clientName} onChange={(event) => setClientName(event.target.value)} />
        </label>
        <label>
          Amount in USDT
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          Who receives cNGN
          <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
        </label>
        <label>
          Their Celo address
          <input
            value={recipient}
            placeholder="0x…"
            onChange={(event) => setRecipient(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="wide">
          What the invoice is for
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="check wide">
          <input
            type="checkbox"
            checked={outsideTeam}
            onChange={(event) => setOutsideTeam(event.target.checked)}
          />
          <span>{recipientName || "The recipient"} is outside this team. cNGN will be paid to their address.</span>
        </label>
      </div>
      <div className="actions">
        <button type="button" onClick={createInvoice} disabled={pending || !outsideTeam}>
          {pending ? "Creating…" : "Create pay link"}
        </button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {created ? (
        <div className="result">
          <strong>
            Pay link for {created.invoice.clientName}, {created.invoice.amount} USDT, to {created.invoice.recipientName}
          </strong>
          <a href={created.payUrl}>{created.payUrl}</a>
          <button
            type="button"
            className="secondary"
            onClick={() => navigator.clipboard.writeText(created.payUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}
    </section>
  );
}
