import { roomActionSchema } from "@/uno/schema";
import { z } from "zod";
import { storedUnoAction, StorageError } from "@/uno/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 20000) throw new Error("Request too large");
    const result = await storedUnoAction(roomActionSchema.parse(JSON.parse(body)));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid request"
            : e instanceof Error
              ? e.message
              : "Request failed",
      },
      { status: e instanceof StorageError ? 503 : 400 },
    );
  }
}
