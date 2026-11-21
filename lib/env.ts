import { existsSync, readFileSync } from "node:fs";

/** Load .env.local then .env without overriding variables already set. Never logs values. */
export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Z0-9_]+$/.test(key) || process.env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Something went wrong";
  const key = process.env.AGENT_PRIVATE_KEY?.trim();
  if (key && raw.includes(key)) return raw.split(key).join("[redacted]");
  return raw;
}

export function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
