import { tratar } from "@/http/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(req: Request) {
  return tratar(req);
}

export function HEAD(req: Request) {
  return tratar(req);
}

export function OPTIONS(req: Request) {
  return tratar(req);
}
