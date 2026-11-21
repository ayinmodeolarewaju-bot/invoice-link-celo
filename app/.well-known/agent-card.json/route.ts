import { agentCard } from "@/lib/registration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(agentCard());
}
