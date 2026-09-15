import { z } from "zod";
import { checkOrigin } from "@/uno/http";
import { listGroups, createGroup } from "@/uno/groups";
export const runtime = "nodejs";

export async function GET() {
  try {
    const groups = await listGroups();
    return Response.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load groups:", error);
    return Response.json(
      { error: "Groups unavailable. Please try again." },
      { status: 503 },
    );
  }
}

const bodySchema = z.object({
  uid: z.string().min(1).max(128),
  name: z.string().min(1).max(20),
  groupName: z.string().min(1).max(40),
});
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  try {
    const body = bodySchema.parse(await request.json());
    const group = await createGroup(body.uid, body.name, body.groupName);
    return Response.json({ group });
  } catch (error) {
    console.error("Failed to create group:", error);
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
