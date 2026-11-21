# Demo outline (under two minutes)

Record or present against the deployed app with `TEXTILE_MODE=mock`, then point at the mainnet runbook for the live corridor. Do not send a mainnet transaction during the recording unless the runbook has already been completed and you are showing those hashes.

## 0:00 — The job

"A client pays a freelancer in USDT. The person who should receive the money is in Nigeria, and they need naira. Invoice Link takes the USDT on Celo, converts it to cNGN on Textile FX, and pays that named person."

## 0:15 — Say it

On the home page, type:

```text
invoice Acme $50, pay out to Ada in naira
```

The form fills in Acme, 50 USDT, and Ada. Paste Ada's address. Tick that Ada is outside the team. Create the pay link.

## 0:40 — The pay link

Open the link. Show the three steps: the client pays USDT, the agent asks Textile for a quote and settles through the LimitOrderReactor, cNGN goes to Ada.

## 1:00 — The corridor

Click **Simulate payment and settlement**. Say that this deploy is in mock mode, so nothing is broadcast. The receipt is the same page the live flow fills with Celoscan hashes.

## 1:20 — The receipt

Show the docket: USDT in, cNGN out, the reactor address, and the attribution suffix for `celo_6a388b8aedfb`. Say that live transactions are tagged in one wallet client, and that the app refuses to send on Celo mainnet if that tag is missing.

## 1:40 — What Brook runs for mainnet

Show `MAINNET_RUNBOOK.md` at the settle command: one wallet, ERC-8004 register, Textile swap, cNGN to a recipient outside the team, receipt transaction on Celoscan.

## 2:00 — Stop

If a live mainnet receipt already exists, leave it on screen: payment hash, swap hash, payout hash, Celoscan.
