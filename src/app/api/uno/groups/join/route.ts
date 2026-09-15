import { z } from "zod";
import { checkOrigin } from "@/uno/http";
import { joinGroup } from "@/uno/groups";
export const runtime = "nodejs";

const bodySchema = z.object({
  uid: z.string().min(1).max(128),
  name: z.string().min(1).max(20),
  groupId: z.string().min(1).max(100),
});
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  try {
    const body = bodySchema.parse(await request.json());
    await joinGroup(body.uid, body.name, body.groupId);
    return Response.json({ joined: true });
  } catch (error) {
    console.error("Failed to join group:", error);
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid request"
            : error instanceof Error
              ? error.message
              : "Request failed",
      },
      { status: 400 },
    );
  }
}
