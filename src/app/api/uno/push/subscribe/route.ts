import { z } from "zod";
import { checkOrigin } from "@/uno/http";
import { saveSubscription } from "@/uno/push";
export const runtime = "nodejs";

const bodySchema = z.object({
  uid: z.string().min(1).max(128),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  try {
    const body = bodySchema.parse(await request.json());
    await saveSubscription(body.uid, body.subscription);
    return Response.json({ saved: true });
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return Response.json(
      { error: error instanceof z.ZodError ? "Invalid request" : "Request failed" },
      { status: 400 },
    );
  }
}
