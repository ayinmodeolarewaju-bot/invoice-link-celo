"use client";

import { useState } from "react";
import type { InvoicePayload } from "@/lib/invoice";

export function PayPanel({
  token,
  invoice,
  simulate,
  chainId,
  agentAddress,
}: {
  token: string;
  invoice: InvoicePayload;
  simulate: boolean;
  chainId: number;
  agentAddress: string | null;
}) {
  const [paymentTx, setPaymentTx] = useState("");
  const [confirmMainnet, setConfirmMainnet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function settle(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${token}/settle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Settlement did not finish.");
      window.location.assign(payload.receiptUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement did not finish.");
      setPending(false);
    }
  }

  return (
    <div>
      {simulate ? (
        <button type="button" disabled={pending} onClick={() => settle({ simulate: true })}>
          {pending ? "Walking the corridor…" : "Simulate payment and settlement"}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            settle({ paymentTx, confirmMainnet });
          }}
        >
          <label>
            USDT payment transaction hash
            <input
              value={paymentTx}
              onChange={(event) => setPaymentTx(event.target.value.trim())}
              placeholder="0x…"
              spellCheck={false}
              required
            />
          </label>
          {chainId === 42220 ? (
            <label className="check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={confirmMainnet}
                onChange={(event) => setConfirmMainnet(event.target.checked)}
              />
              <span>Send this on Celo mainnet from the one agent wallet.</span>
            </label>
          ) : null}
          <div className="actions">
            <button type="submit" disabled={pending || !agentAddress}>
              {pending ? "Settling…" : "Convert and pay cNGN"}
            </button>
          </div>
        </form>
      )}
      {error ? <p className="error" role="status">{error}</p> : null}
      <p className="note">
        {simulate
          ? "Mock mode broadcasts nothing. The receipt is labelled simulated."
          : agentAddress
            ? `Send the exact USDT amount to ${agentAddress} on chain ${chainId}, then paste that transaction hash.`
            : "Set AGENT_PRIVATE_KEY before a live settlement. The address above is the single event wallet."}
      </p>
    </div>
  );
}
