import { publicStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(publicStatus());
}
