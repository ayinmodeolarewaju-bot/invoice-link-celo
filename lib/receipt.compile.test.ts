import { describe, expect, it } from "vitest";
import { compileReceipt } from "./compileReceipt";

describe("InvoiceReceipt", () => {
  it("compiles and exposes settle", () => {
    const compiled = compileReceipt();
    expect(compiled.bytecode.length).toBeGreaterThan(20);
    const names = compiled.abi.filter((item) => item.type === "function").map((item) => item.name);
    expect(names).toContain("settle");
    expect(names).toContain("getReceipt");
    expect(names).toContain("agent");
  });
});
