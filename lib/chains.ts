import { getAddress, type Address, type Chain } from "viem";
import { bscTestnet, celo, celoSepolia } from "viem/chains";

export const CELO_MAINNET_ID = 42220;
export const CELO_SEPOLIA_ID = 11142220;
export const BSC_TESTNET_ID = 97;

/** This entry's public Loops tag. Documented default only. Sends read ATTRIBUTION_TAG. */
export const PUBLIC_ATTRIBUTION_TAG = "celo_6a388b8aedfb";

const a = (value: string): Address => getAddress(value);

export const TOKENS = {
  celo: {
    usdt: a("0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e"),
    cngn: a("0xf6829d7393dae24509eb1e52ee8e572e2e271a4f"),
    reactor: a("0xa9aa0a64769cbed4d3b1ceb4df01cde915c235b3"),
    vaultExecutor: a("0x01b006d5c687bde182aa36f542f1f014144742e2"),
    identity: a("0x8004a169fb4a3325136eb29fa0ceb6d2e539a432"),
    reputation: a("0x8004baa17c55a88189ae136b182e5fda19de9b63"),
    usdtDecimals: 6,
    cngnDecimals: 6,
  },
  celoSepolia: {
    identity: a("0x8004a818bfb912233c491871b3d84c89a494bd9e"),
    reputation: a("0x8004b663056a597dffe9eccc1965a193b7388713"),
  },
  bscTestnet: {
    usdt: a("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd"),
    cngn: a("0x8a078b182ba9649c03982c2a80cdcc81cdc99da8"),
    reactor: a("0x65b2f3847b391783e15554d5f2826fbaf318a7df"),
    usdtDecimals: 18,
    cngnDecimals: 6,
  },
} as const;

export type TextileMode = "mock" | "bsc-testnet" | "celo";
export type AppChainName = "celo-sepolia" | "celo";

export function textileMode(): TextileMode {
  const mode = (process.env.TEXTILE_MODE || "mock").trim();
  if (mode === "mock" || mode === "bsc-testnet" || mode === "celo") return mode;
  throw new Error(`TEXTILE_MODE must be mock, bsc-testnet, or celo. Received ${mode}.`);
}

export function appChainName(): AppChainName {
  const name = (process.env.APP_CHAIN || "celo-sepolia").trim();
  if (name === "celo-sepolia" || name === "celo") return name;
  throw new Error(`APP_CHAIN must be celo-sepolia or celo. Received ${name}.`);
}

export function appChain(): Chain {
  return appChainName() === "celo" ? celo : celoSepolia;
}

export function settlementChain(): Chain {
  const mode = textileMode();
  if (mode === "celo") return celo;
  if (mode === "bsc-testnet") return bscTestnet;
  return appChain();
}

export function chainById(chainId: number): Chain {
  if (chainId === celo.id) return celo;
  if (chainId === celoSepolia.id) return celoSepolia;
  if (chainId === bscTestnet.id) return bscTestnet;
  throw new Error(`Unsupported chain ${chainId}.`);
}

export function rpcUrl(chainId: number): string {
  if (chainId === CELO_MAINNET_ID) return process.env.CELO_RPC_URL?.trim() || "https://forno.celo.org";
  if (chainId === CELO_SEPOLIA_ID) {
    return process.env.CELO_SEPOLIA_RPC_URL?.trim() || "https://forno.celo-sepolia.celo-testnet.org";
  }
  if (chainId === BSC_TESTNET_ID) {
    return process.env.BSC_TESTNET_RPC_URL?.trim() || "https://data-seed-prebsc-1-s1.binance.org:8545";
  }
  throw new Error(`No RPC configured for chain ${chainId}.`);
}

export function corridorTokens(chainId: number): {
  usdt: Address;
  cngn: Address;
  reactor: Address;
  usdtDecimals: number;
  cngnDecimals: number;
} {
  if (chainId === CELO_MAINNET_ID) return TOKENS.celo;
  if (chainId === BSC_TESTNET_ID) return TOKENS.bscTestnet;
  throw new Error(`Textile settlement is not deployed on chain ${chainId}. Use TEXTILE_MODE=mock on Celo Sepolia.`);
}

export function identityRegistry(chainId: number): Address {
  if (chainId === CELO_MAINNET_ID) return TOKENS.celo.identity;
  if (chainId === CELO_SEPOLIA_ID) return TOKENS.celoSepolia.identity;
  throw new Error(`No ERC-8004 Identity Registry for chain ${chainId}.`);
}

export function txExplorerUrl(chainId: number, hash: string): string | null {
  if (chainId === CELO_MAINNET_ID) return `https://celoscan.io/tx/${hash}`;
  if (chainId === CELO_SEPOLIA_ID) return `https://celo-sepolia.blockscout.com/tx/${hash}`;
  if (chainId === BSC_TESTNET_ID) return `https://testnet.bscscan.com/tx/${hash}`;
  return null;
}

export function addressExplorerUrl(chainId: number, address: string): string | null {
  if (chainId === CELO_MAINNET_ID) return `https://celoscan.io/address/${address}`;
  if (chainId === CELO_SEPOLIA_ID) return `https://celo-sepolia.blockscout.com/address/${address}`;
  if (chainId === BSC_TESTNET_ID) return `https://testnet.bscscan.com/address/${address}`;
  return null;
}
