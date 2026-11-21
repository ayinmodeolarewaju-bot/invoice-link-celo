# Invoice Link on Celo

An agent that lets a freelancer or small business invoice a client in USDT on Celo. The client pays the invoice link. The agent converts that USDT to cNGN through [Textile FX](https://fx-docs.textilecredit.com/) and pays the naira stablecoin to a named recipient. A receipt page lists every transaction hash and links to Celoscan.

Built for [Agents Open for Business](https://www.loops.house/agents-open-for-business), Track 1 Stablecoin Corridors (Textile FX). Build window 20 Nov 2026 – 7 Dec 2026, 09:00 GMT. All of the code in this repository was written inside that window.

The product shape borrows from the earlier NEAR Invoice Link (a shareable pay link and a receipt), and the settlement rail is new: Celo, Textile RFQ, cNGN, ERC-8004, and ERC-8021.

This entry uses one agent wallet for the whole event. That address registers the ERC-8004 identity, sends the Textile swap, pays cNGN, and is the address you add to the Loops entry. The public attribution tag is `celo_6a388b8aedfb`. It is the default in `.env.example`. `lib/wallet.ts` is the only place a wallet client is built, and `withAttribution` from `@celo/attribution-tags` tags every send from that client. A mainnet send is refused when `ATTRIBUTION_TAG` is unset.

## Problem

A designer in Lagos finishes a job for a client who pays in dollars. The client can send USDT today. The designer needs naira, in the name of a person who is not the freelancer's own wallet: a collaborator, a supplier, a family member. Correspondent banks take days. An OTC desk asks for a relationship and a minimum.

Invoice Link collapses that into one link.

1. The freelancer says who is owed, how many dollars, and which Nigerian address should receive cNGN.
2. The client opens the link and pays USDT on Celo.
3. The agent asks Textile for a firm quote, signs nothing it does not have to, and settles through Textile's `LimitOrderReactor`.
4. cNGN lands with the named recipient, outside the team.
5. The receipt is on-chain: payment hash, swap hash, payout hash, Celoscan links.

Arbitrage and self-trading are out of scope. The counted conversion is a payout to someone else.

## Track fit

| Requirement | How this repo meets it |
|---|---|
| Celo mainnet (chain 42220) is what counts | Settlement, payout, receipt, and ERC-8004 registration all target mainnet. Celo Sepolia and the Textile BSC testnet sandbox are for rehearsal only. |
| Textile FX USDT → cNGN inside the product | `lib/textile.ts` calls `POST /v2/rfq/request`, then broadcasts `transactions.swap` to the LimitOrderReactor. The RFQ floor is about $1. |
| Recipient outside the team | The invoice names that person and their address. The payout is an ERC-20 transfer of cNGN to that address, not back to the agent. |
| ERC-8004 identity | `scripts/register-8004.ts` registers on the Identity Registry. Mainnet `0x8004A169FB4a3325136EB29fA0ceB6D2e539A432`. Sepolia test `0x8004A818BFB912233c491871b3d84c89A494BD9e`. |
| ERC-8021 attribution on every mainnet tx | `ATTRIBUTION_TAG` (issued when the entry is enrolled on Loops). Textile swaps get the suffix appended to `transactions.swap.data`, with `includeAttribution` left off so the Loops tag is the only one. Every other send uses `@celo/attribution-tags`. |
| No tag, no mainnet send | `assertMainnetAllowed()` throws before any chain-42220 broadcast if `ATTRIBUTION_TAG` is missing. |
| No secrets in git | Keys and the tag live in env vars. `.env.example` lists them. `.env` is gitignored. |

This repository does not send mainnet transactions and does not fund wallets. The person running the entry does that, with [MAINNET_RUNBOOK.md](MAINNET_RUNBOOK.md), on a budget of about 1–2 CELO and $2–5 USDT.

## Architecture

```
freelancer                         client                         named recipient
    │                                │                                  │
    │  "invoice Acme $50,            │                                  │
    │   pay out to Ada in naira"     │                                  │
    ▼                                │                                  │
┌────────────┐   pay link    ┌──────────────┐                            │
│ Next.js UI │──────────────▶│ Pay page     │                            │
│ /api/agent │               │ USDT transfer│                            │
└────────────┘               └──────┬───────┘                            │
                                    │ payment tx                         │
                                    ▼                                    │
                             ┌──────────────┐   quote, then swap         │
                             │ Agent wallet │──────────────────┐         │
                             │ (server)     │                  ▼         │
                             └──────┬───────┘         Textile FX RFQ     │
                                    │                 LimitOrderReactor  │
                                    │  cNGN transfer + receipt           │
                                    ▼                                    ▼
                             ReceiptRegistry                      Ada's wallet
                             (event + Celoscan)                   (cNGN)
```

- **Invoice token.** Creating an invoice signs a small JSON payload with `INVOICE_SIGNING_SECRET`. The pay link carries that token, so the app does not need a database. The signature is HMAC-SHA256. The server is the only place that can mint a receipt token.
- **Pay.** The client sends USDT to the agent wallet. The app checks the transfer log (token, recipient, amount, success). A flagged simulation exists for the testnet demo and never pretends the hashes were broadcast.
- **Quote.** `POST https://api.textilecredit.com/v2/rfq/preview` for the indicative price. `POST /v2/rfq/request` for the firm quote. Keyless callers sign Textile's `TakerControl` EIP-712 proof with the agent wallet. A partner key, if set, skips that proof. `includeAttribution` stays false.
- **Swap.** Approve `takerPays` of USDT to the reactor the quote names (reset to zero first when the token rejects a non-zero to non-zero approve). Append `toDataSuffix(ATTRIBUTION_TAG)` to `transactions.swap.data`. Broadcast that calldata from the taker. Report the hash to `/v2/rfq/{id}/submit`.
- **Payout and receipt.** One transaction on `InvoiceReceipt` pulls cNGN from the agent and forwards it to the named recipient, emitting `InvoiceSettled` with the payment hash and the swap hash. That transaction is tagged too.
- **Agent entry.** `POST /api/agent` accepts a sentence or a small JSON intent. `/.well-known/agent-card.json` and `/agent.json` are the A2A card and the ERC-8004 registration file.

### Networks

| Role | Chain | Id | Notes |
|---|---|---|---|
| Counted activity | Celo | 42220 | USDT, cNGN, Textile reactor, ERC-8004, receipt |
| Rehearsal | Celo Sepolia | 11142220 | Faucet at https://faucet.celo.org/celo-sepolia. No Textile reactor. |
| Textile sandbox | BNB Smart Chain testnet | 97 | cNGN/USDT. Floor about $0.01. `TEXTILE_MODE=bsc-testnet`. |

`TEXTILE_MODE=mock` runs the same steps against a fake quote and writes no transaction. The receipt says so in the page and in the API. Mock is the default, so a deploy cannot spend funds by accident.

### Addresses verified against the docs

Checked against the Textile address book (https://docs.textilecredit.com/protocol/address-book.html) and the Loops track page on 20 Nov 2026. Celo mainnet:

| Asset or contract | Address |
|---|---|
| USDT | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` (6 decimals) |
| cNGN | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` (6 decimals) |
| LimitOrderReactor | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |
| Fee controller (2 bps) | `0x356f4FBe18893997D2F893AE8860eD6060b4521d` |
| VaultOrderExecutor | `0x01b006d5c687bde182aa36F542f1f014144742e2` |
| Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539A432` |
| Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

The quote names the spender. When a fill comes from an operator vault, that spender is the executor, not the reactor. The agent approves the address on the quote.

BSC testnet sandbox: reactor `0x65B2f3847b391783e15554D5f2826FBaF318a7Df`, cNGN `0x8a078b182bA9649c03982c2a80CDcc81cdc99dA8` (6 decimals), USDT `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` (18 decimals).

## Repository map

| Path | What it is |
|---|---|
| `app/` | Next.js UI: builder, pay page, receipt, agent card, registration file |
| `lib/` | Invoice tokens, attribution guard, Textile client, settlement |
| `contracts/InvoiceReceipt.sol` | On-chain receipt and cNGN forwarder |
| `scripts/register-8004.ts` | ERC-8004 `register()` on Sepolia or mainnet |
| `scripts/deploy-receipt.ts` | Deploy `InvoiceReceipt` |
| `scripts/settle-invoice.ts` | Quote, swap, pay out, record (the runbook command) |
| `scripts/preview-quote.ts` | Read-only Textile preview. Sends no transaction. |
| `MAINNET_RUNBOOK.md` | The only mainnet procedure. Run by a person, in order. |
| `DEMO.md` | Two-minute demo outline |

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The default is Celo Sepolia plus `TEXTILE_MODE=mock`.

Try the agent box:

```text
invoice Acme $50, pay out to Ada in naira at 0x1111111111111111111111111111111111111111
```

The builder asks for a recipient address when the sentence does not contain one, and it asks you to confirm the recipient is outside the team.

```bash
npm test
npm run build
```

### Environment

See `.env.example`. The ones that matter:

| Variable | Required | Purpose |
|---|---|---|
| `ATTRIBUTION_TAG` | Before any mainnet send | Loops ERC-8021 code, `[a-z0-9_]{1,32}`. The app refuses chain 42220 without it. |
| `AGENT_PRIVATE_KEY` | Before a real send | Agent wallet. Server-side only. Never commit it. |
| `INVOICE_SIGNING_SECRET` | Production | HMAC key for invoice and receipt tokens. |
| `TEXTILE_MODE` | | `mock` (default), `bsc-testnet`, or `celo`. |
| `TEXTILE_API_KEY` | Optional | `tx_live_…` or `tx_test_…`. Leave `includeAttribution` off either way. |
| `APP_CHAIN` | | `celo-sepolia` (default) or `celo`. |
| `RECEIPT_REGISTRY` | Before a real payout | Deployed `InvoiceReceipt`. |
| `NEXT_PUBLIC_APP_URL` | | Public origin, used in `/agent.json`. |

A test key (`tx_test_…`) only works on BSC testnet (97) and Base Sepolia (84532). It cannot quote Celo. Celo Sepolia has no Textile deployment.

## Scripts

```bash
# Read-only. Confirms the Identity Registry has code. No transaction.
npm run check:registries

# Read-only Textile preview for 1 USDT → cNGN on Celo. No transaction.
npm run preview:quote

# Sepolia rehearsal of ERC-8004. Refuses mainnet if ATTRIBUTION_TAG is unset.
npm run register:8004 -- --chain celo-sepolia

# Deploy the receipt contract. Same mainnet guard.
npm run deploy:receipt -- --chain celo-sepolia

# Settle one paid invoice. Same mainnet guard.
npm run settle -- --token <invoiceToken> --payment-tx 0x...
```

Mainnet is `--chain celo`. Do that only by following [MAINNET_RUNBOOK.md](MAINNET_RUNBOOK.md).

## Demo

[DEMO.md](DEMO.md) is a two-minute script. The short version: say the sentence, open the pay link, run the corridor (simulated, or live once the runbook is done), and land on the receipt.

## Verified without spending

On 21 Nov 2026, from this repository, with no transaction sent:

- `npm test` covers the invoice token, the sentence parser, the Textile request body (`includeAttribution: false`), the refusal to build a wallet when `ATTRIBUTION_TAG` is missing, and a send through that wallet client whose calldata decodes to `celo_6a388b8aedfb`.
- `npm run check:registries` read code at the Identity Registry: 130 bytes on Celo mainnet `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` and 130 bytes on Celo Sepolia `0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- `npm run preview:quote` received an indicative Textile preview for 1 USDT → cNGN on Celo: `buyAmount` `1444417155` (about 1,444.42 cNGN) and `takerPays` `1000000`. That is not a firm quote and it was not executed.
- The app, with `TEXTILE_MODE=mock`, created an invoice from “invoice Acme $50, pay out to Ada in naira”, simulated settlement, and showed a receipt stamped SIMULATED with the tag and no transaction hashes.
- `npm run register:8004 -- --chain celo` exits before sending, because `--confirm-mainnet` was not passed.

## What this project will not do

- It will not broadcast a Celo mainnet transaction while `ATTRIBUTION_TAG` is empty.
- It will not put a private key, an API key, or a claim token in the repository or in a receipt.
- It will not turn on Textile's own attribution suffix. Loops told builders to append their own tag and, when using an API key, to leave `includeAttribution` off so two suffixes do not hide each other. Indexers read the last tag.
- It will not count a swap from the agent back to itself. The payout address is a field on the invoice, and the runbook tells you to use someone outside the team.

## License

MIT. See [LICENSE](LICENSE).
