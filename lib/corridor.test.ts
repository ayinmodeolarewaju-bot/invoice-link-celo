import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { PUBLIC_ATTRIBUTION_TAG, TOKENS } from "./chains";
import { buildRfqBody } from "./textile";

describe("corridor addresses", () => {
  it("matches the Textile and ERC-8004 addresses from the docs", () => {
    expect(TOKENS.celo.usdt).toBe(getAddress("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"));
    expect(TOKENS.celo.cngn).toBe(getAddress("0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f"));
    expect(TOKENS.celo.reactor).toBe(getAddress("0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3"));
    expect(TOKENS.celo.identity).toBe(getAddress("0x8004A169FB4a3325136EB29fA0ceB6D2e539A432"));
    expect(TOKENS.celoSepolia.identity).toBe(getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e"));
    expect(TOKENS.bscTestnet.reactor).toBe(getAddress("0x65B2f3847b391783e15554D5f2826FBaF318a7Df"));
    expect(TOKENS.bscTestnet.usdt).toBe(getAddress("0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"));
    expect(TOKENS.bscTestnet.cngn).toBe(getAddress("0x8a078b182bA9649c03982c2a80CDcc81cdc99dA8"));
  });

  it("documents the public Loops tag and no private key in the example env", () => {
    const example = readFileSync(".env.example", "utf8");
    const runbook = readFileSync("MAINNET_RUNBOOK.md", "utf8");
    expect(example).toContain(`ATTRIBUTION_TAG=${PUBLIC_ATTRIBUTION_TAG}`);
    expect(example).not.toMatch(/0x[0-9a-fA-F]{64}/);
    expect(runbook).toContain(PUBLIC_ATTRIBUTION_TAG);
    expect(runbook.toLowerCase()).toContain("one agent wallet");
  });

  it("builds a Textile request that leaves includeAttribution off", () => {
    const body = buildRfqBody({
      chainId: 42220,
      sellToken: TOKENS.celo.usdt,
      buyToken: TOKENS.celo.cngn,
      sellAmount: 1_000_000n,
      taker: "0x1111111111111111111111111111111111111111",
    });
    expect(body.includeAttribution).toBe(false);
    expect(body).not.toHaveProperty("builderCodes");
  });

  it("adds the attribution extension in the wallet module only", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".next" || name === ".git") continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!full.endsWith(".ts") && !full.endsWith(".tsx")) continue;
        if (full.endsWith(".test.ts")) continue;
        const text = readFileSync(full, "utf8");
        if (text.includes("withAttribution") && !full.endsWith(`${path.sep}lib${path.sep}wallet.ts`)) {
          offenders.push(full);
        }
      }
    };
    walk(process.cwd());
    expect(offenders).toEqual([]);
    const wallet = readFileSync("lib/wallet.ts", "utf8");
    expect(wallet).toContain("withAttribution");
    expect(wallet).not.toContain("process.env.PRIVATE_KEY");
  });
});
