import { appOrigin } from "./env";
import { appChain, identityRegistry } from "./chains";

export function agentRegistration() {
  const origin = appOrigin();
  const chain = appChain();
  const agentId = process.env.ERC8004_AGENT_ID?.trim();
  const registry = identityRegistry(chain.id);
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Invoice Link on Celo",
    description:
      "Invoices a client in USDT on Celo, converts the payment to cNGN through Textile FX, and pays a named recipient outside the team.",
    services: [
      { name: "web", endpoint: origin },
      {
        name: "A2A",
        endpoint: `${origin}/.well-known/agent-card.json`,
        version: "0.3.0",
      },
      { name: "agent", endpoint: `${origin}/api/agent` },
    ],
    x402Support: false,
    active: true,
    supportedTrust: ["reputation"],
    ...(agentId
      ? {
          registrations: [
            {
              agentId: Number(agentId),
              agentRegistry: `eip155:${chain.id}:${registry}`,
            },
          ],
        }
      : {}),
  };
}

export function agentCard() {
  const origin = appOrigin();
  return {
    name: "Invoice Link on Celo",
    description:
      "Create a USDT invoice on Celo. After the client pays, the agent converts to cNGN on Textile FX and pays a named recipient.",
    url: origin,
    version: "0.1.0",
    capabilities: { streaming: false },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"],
    skills: [
      {
        id: "create-invoice",
        name: "Create a USDT invoice that pays out in cNGN",
        description:
          "Parse a sentence or a JSON intent, then return a pay link. The recipient must be outside the team.",
        examples: [
          "invoice Acme $50, pay out to Ada in naira at 0x1111111111111111111111111111111111111111",
        ],
      },
    ],
  };
}
