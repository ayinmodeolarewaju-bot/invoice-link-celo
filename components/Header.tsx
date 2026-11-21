import Link from "next/link";
import { publicStatus } from "@/lib/status";

export function Header() {
  const status = publicStatus();
  return (
    <header className="top">
      <Link className="brand" href="/">
        <span className="mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 13c3.5-7 10.5-7 14 0" stroke="#e4c27a" strokeWidth="1.6" />
            <circle cx="9" cy="6" r="1.5" fill="#f4efe4" />
          </svg>
        </span>
        <span>
          <strong>Invoice Link</strong>
          <span>USDT in. cNGN out. On Celo.</span>
        </span>
      </Link>
      <div className="pills">
        <span className="pill">
          Mode <strong>{status.textileMode}</strong>
        </span>
        <span className="pill">
          Chain <strong>{status.settlementChainId}</strong>
        </span>
        <span className="pill">
          Tag <strong>{status.attribution.configured ? status.attribution.tag : "not set"}</strong>
        </span>
      </div>
    </header>
  );
}
