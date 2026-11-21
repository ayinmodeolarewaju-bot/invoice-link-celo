# Mainnet runbook

Brook runs these steps. The agent that wrote this repository does not send Celo mainnet transactions and does not fund wallets.

Counted activity is Celo mainnet, chain 42220. Budget about 1–2 CELO for gas and $2–5 USDT for one real invoice. The Textile RFQ floor is about $1.

Use **one agent wallet** for the whole event. The score, the ERC-8004 identity, and the Loops entry all point at that address. Do not create a second wallet for registration, the swap, or the payout.

The public attribution tag for this entry is `celo_6a388b8aedfb`. It is already the default in `.env.example`. Every transaction is tagged in one place, `lib/wallet.ts`, where the wallet client is built with `withAttribution`. Textile quotes are requested with `includeAttribution: false`. The client appends the Loops tag to `transactions.swap.data` when it sends the swap. If `ATTRIBUTION_TAG` is unset, the process refuses to send.

## 0. Enroll

Enroll at https://www.loops.house/agents-open-for-business if this entry is not already enrolled. The tag issued for this entry is:

```text
celo_6a388b8aedfb
```

Add the same agent address to the Loops entry after step 4, under agent wallet. Do that in the Loops UI. This repository does not update the Loops project for you.

## 1. Configure

```bash
cd invoice-link-celo
npm install
cp .env.example .env.local
```

`.env.example` already contains:

```text
ATTRIBUTION_TAG=celo_6a388b8aedfb
```

Keep that value. Then edit `.env.local`:

```text
AGENT_PRIVATE_KEY=0x...        # the one event wallet, hex, never commit it
INVOICE_SIGNING_SECRET=...     # at least 16 random characters
TEXTILE_MODE=celo
APP_CHAIN=celo
NEXT_PUBLIC_APP_URL=https://your-deployment.example
```

Leave `TEXTILE_API_KEY` empty unless you created a `tx_live_` key. Do not turn on Textile's `includeAttribution`.

Create the wallet in any wallet you control. Fund that same address with about 1–2 CELO and $2–5 of Celo USDT (`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`). A Celo Sepolia rehearsal can use the faucet at https://faucet.celo.org/celo-sepolia and does not need mainnet funds.

## 2. Read-only checks

These commands do not send transactions.

```bash
npm run check:registries
npm run preview:quote
```

`check:registries` confirms the ERC-8004 Identity Registry has code on Celo mainnet (`0x8004A169FB4a3325136EB29fA0ceB6D2e539A432`) and on Celo Sepolia (`0x8004A818BFB912233c491871b3d84c89A494BD9e`).

`preview:quote` asks Textile for an indicative 1 USDT → cNGN price. A `no_quote` means no maker answered. It still sends nothing.

## 3. Deploy the receipt, from the one wallet

```bash
npm run deploy:receipt -- --chain celo --confirm-mainnet
```

Without `--confirm-mainnet` the script exits before sending. Copy the printed address into `.env.local`:

```text
RECEIPT_REGISTRY=0x...
```

The contract's `agent` is the deployer, which is `AGENT_PRIVATE_KEY`. Payouts from any other key revert.

Sepolia rehearsal, still the same key, no `--confirm-mainnet`:

```bash
npm run deploy:receipt -- --chain celo-sepolia
```

## 4. Register ERC-8004, from the same wallet

```bash
npm run register:8004 -- --chain celo --confirm-mainnet
```

The script prints `agentId`. Put it in `.env.local`:

```text
ERC8004_AGENT_ID=12345
```

Restart the app so `/agent.json` includes that registration. Then add this same address as the agent wallet on the Loops entry: https://www.loops.house/agents-open-for-business/playground/submit

Sepolia rehearsal:

```bash
npm run register:8004 -- --chain celo-sepolia
```

## 5. Create the invoice

The recipient must be a person or business **outside the team**, with their own Celo address. A swap back to the agent wallet does not count.

Open the app, or call the agent:

```bash
curl -s -X POST http://localhost:3000/api/agent \
  -H 'content-type: application/json' \
  -d '{"message":"invoice Acme $2, pay out to Ada in naira at 0xRECIPIENT","outsideTeam":true}'
```

Use at least $1. $2 fits the budget. Open the pay URL in the response.

## 6. Client pays USDT

From the recipient's side, or from the client's wallet, send the exact invoice amount of Celo USDT to the agent address shown on the pay page. That payment is their transaction. Keep the transaction hash.

The pay page accepts the hash and will not settle a transfer that is the wrong token, the wrong amount, or not to the agent.

## 7. Quote, swap, pay cNGN, record the receipt

```bash
npm run settle -- --token '<invoice token from the pay URL>' --payment-tx 0xPAYMENT --confirm-mainnet
```

The command, in order:

1. Refuses to run on chain 42220 without `--confirm-mainnet`.
2. Refuses to build a wallet if `ATTRIBUTION_TAG` is missing.
3. Checks the USDT transfer.
4. Requests a Textile firm quote for USDT → cNGN with `includeAttribution: false`.
5. Approves `takerPays` of USDT to the spender the quote names. The wallet client tags that approval.
6. Sends `transactions.swap` through the same client, which appends `celo_6a388b8aedfb` to the swap calldata.
7. Checks the swap carries the tag. If it does not, the script stops before the payout.
8. Approves cNGN to `InvoiceReceipt` and calls `settle`, which forwards cNGN to the named recipient and emits `InvoiceSettled`.

The JSON it prints includes `swapTx`, `payoutTx`, and Celoscan links. The pay page can do the same steps when `TEXTILE_MODE=celo` and the confirm box is checked.

## 8. Look at the receipt

Open the receipt URL. It shows the payment hash, the swap hash, the payout hash, and a Celoscan link for each. The payout transaction is the on-chain receipt.

Confirm the tag on the swap:

```bash
npx tsx -e '
import { verifyTx } from "@celo/attribution-tags";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org") });
const result = await verifyTx({ client, hash: process.argv[1] });
console.log(result);
' -- 0xSWAP_HASH
```

`codes` must include `celo_6a388b8aedfb`.

On the Loops checklist, use Find it. Loops scans this agent wallet for its first tagged mainnet transaction in the event window.

## What stays off mainnet

| Command | Sends a mainnet transaction? |
|---|---|
| `npm test`, `npm run dev`, `npm run build` | No |
| `npm run check:registries`, `npm run preview:quote` | No |
| `TEXTILE_MODE=mock` settle | No |
| `npm run deploy:receipt -- --chain celo-sepolia` | No, Sepolia only |
| `npm run register:8004 -- --chain celo-sepolia` | No, Sepolia only |
| The three mainnet commands above, with `--confirm-mainnet` | Yes, and only from the one agent wallet |

`TEXTILE_MODE=bsc-testnet` rehearses the quote and swap on BNB Smart Chain testnet (chain 97), where Textile's sandbox lives. Those transactions are not the scored Celo activity. The tag is still applied, because the same wallet client is used.
