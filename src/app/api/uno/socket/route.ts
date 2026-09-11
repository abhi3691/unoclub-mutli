import { experimental_upgradeWebSocket } from "@vercel/functions";
import { handleRoomSocket } from "@/uno/socket";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)
  )
    return new Response("Invalid origin", { status: 403 });
  try {
    return await experimental_upgradeWebSocket(handleRoomSocket, { maxPayload: 20000 });
  } catch {
    return Response.json(
      {
        error:
          "WebSocket upgrades require Vercel or vercel dev. HTTP fallback remains available.",
      },
      { status: 503 },
    );
  }
}
