import { Builder } from "@/components/Builder";
import { Header } from "@/components/Header";
import { PUBLIC_ATTRIBUTION_TAG } from "@/lib/chains";

export default function HomePage() {
  return (
    <div className="shell">
      <Header />
      <main id="content">
        <section className="hero">
          <div>
            <h1>Invoice in dollars. Pay someone in naira.</h1>
            <p className="lede">
              A client pays USDT on Celo. This agent converts it to cNGN through Textile FX and sends the naira stablecoin to a person you name.
            </p>
          </div>
          <ol className="rail">
            <li className="step"><span className="num">1</span><span><b>Client pays USDT</b><span>The invoice link shows the agent wallet.</span></span></li>
            <li className="step"><span className="num">2</span><span><b>Textile quotes, then swaps</b><span>USDT to cNGN through the LimitOrderReactor.</span></span></li>
            <li className="step"><span className="num">3</span><span><b>cNGN reaches them</b><span>The payout transaction is the on-chain receipt.</span></span></li>
          </ol>
        </section>
        <Builder />
        <footer>
          Agents Open for Business, Track 1 Stablecoin Corridors. One agent wallet. Attribution tag {PUBLIC_ATTRIBUTION_TAG}, applied in the wallet client. Live sends stay off until you follow the mainnet runbook.
        </footer>
      </main>
    </div>
  );
}
