import { readFileSync } from "node:fs";
import path from "node:path";
import solc from "solc";
import type { Abi, Hex } from "viem";

export function compileReceipt(): { abi: Abi; bytecode: Hex } {
  const file = path.join(process.cwd(), "contracts", "InvoiceReceipt.sol");
  const source = readFileSync(file, "utf8");
  const input = {
    language: "Solidity",
    sources: { "InvoiceReceipt.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
  };
  const errors = (output.errors ?? []).filter((error) => error.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  }
  const contract = output.contracts["InvoiceReceipt.sol"].InvoiceReceipt;
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}
