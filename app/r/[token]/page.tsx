import Link from "next/link";
import { Header } from "@/components/Header";
import { readSigned } from "@/lib/invoice";
import type { InvoicePayload } from "@/lib/invoice";
import type { Settlement } from "@/lib/settle";
import { fromDataSuffix } from "@celo/attribution-tags";

type ReceiptDoc = { invoice: InvoicePayload; settlement: Settlement };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let doc: ReceiptDoc;
  try {
    doc = readSigned<ReceiptDoc>(decodeURIComponent(token));
  } catch (error) {
    return (
      <div className="shell">
        <Header />
        <main id="content" className="panel">
          <h1>This receipt does not open</h1>
          <p>{error instanceof Error ? error.message : "The token could not be read."}</p>
        </main>
      </div>
    );
  }

  const { invoice, settlement } = doc;
  const codes = settlement.attributionSuffix ? fromDataSuffix(settlement.attributionSuffix)?.codes ?? [] : [];
  const rows = [
    ["Payment", settlement.paymentTx, settlement.explorers.payment],
    ["USDT approval", settlement.approvalTx, settlement.explorers.approval],
    ["Textile swap", settlement.swapTx, settlement.explorers.swap],
    ["cNGN payout and receipt", settlement.payoutTx, settlement.explorers.payout],
  ] as const;

  return (
    <div className="shell">
      <Header />
      <main id="content" className="panel">
        <span className={settlement.simulated ? "stamp" : "stamp live"}>
          {settlement.simulated ? "SIMULATED" : "PAID"}
        </span>
        <h1 style={{ marginTop: 18 }}>Receipt for {invoice.clientName}</h1>
        <p className="lede">{settlement.note}</p>
        <dl>
          <dt>USDT in</dt>
          <dd>{settlement.usdtIn}</dd>
          <dt>cNGN out</dt>
          <dd>{settlement.cngnOut}</dd>
          <dt>Fee</dt>
          <dd>{settlement.feeAmount}</dd>
          <dt>Rate</dt>
          <dd>{settlement.rateLabel}</dd>
          <dt>Recipient</dt>
          <dd>{invoice.recipientName} · <span className="hash">{invoice.recipient}</span></dd>
          <dt>Reactor</dt>
          <dd className="hash">{settlement.reactor}</dd>
          <dt>Invoice id</dt>
          <dd className="hash">{settlement.invoiceId}</dd>
          <dt>Attribution</dt>
          <dd>
            {settlement.attributionTag
              ? `${settlement.attributionTag}${settlement.attributionVerified ? " · verified on the transaction" : ""}`
              : "No tag was configured. A live send would be refused."}
            {codes.length > 0 ? <div className="hash">codes: {codes.join(", ")}</div> : null}
          </dd>
        </dl>
        <h2>Transactions</h2>
        <dl>
          {rows.map(([label, hash, href]) => (
            <span key={label} style={{ display: "contents" }}>
              <dt>{label}</dt>
              <dd>
                {hash ? (
                  href ? <a href={href}>{hash}</a> : <span className="hash">{hash}</span>
                ) : (
                  <span>{settlement.simulated ? "Not broadcast" : "No separate transaction"}</span>
                )}
              </dd>
            </span>
          ))}
        </dl>
        {settlement.explorers.payout ? (
          <p><a href={settlement.explorers.payout}>Open the receipt transaction</a></p>
        ) : null}
        <p><Link href="/">Create another invoice</Link></p>
      </main>
    </div>
  );
}
