import { Header } from "@/components/Header";
import { PayPanel } from "@/components/PayPanel";
import { readInvoiceToken } from "@/lib/invoice";
import { publicStatus } from "@/lib/status";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let invoice;
  try {
    invoice = readInvoiceToken(decodeURIComponent(token));
  } catch (error) {
    return (
      <div className="shell">
        <Header />
        <main id="content" className="panel">
          <h1>This pay link does not open</h1>
          <p>{error instanceof Error ? error.message : "The token could not be read."}</p>
        </main>
      </div>
    );
  }
  const status = publicStatus();

  return (
    <div className="shell">
      <Header />
      <main id="content" className="panel ticket">
        <section>
          <p className="meta">Invoice for {invoice.clientName}</p>
          <p className="amount">${invoice.amount}</p>
          <p>USDT on Celo, then cNGN to {invoice.recipientName}.</p>
          <p>{invoice.description}</p>
        </section>
        <section>
          <dl>
            <dt>Recipient</dt>
            <dd>{invoice.recipientName}</dd>
            <dt>Address</dt>
            <dd className="hash">{invoice.recipient}</dd>
            <dt>Agent wallet</dt>
            <dd className="hash">{status.agentAddress ?? "Not configured. Simulation still runs."}</dd>
            <dt>Settlement</dt>
            <dd>{status.textileMode} · chain {status.settlementChainId}</dd>
          </dl>
          <div style={{ marginTop: 18 }}>
            <PayPanel
              token={token}
              invoice={invoice}
              simulate={status.simulate}
              chainId={status.settlementChainId}
              agentAddress={status.agentAddress}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
