import { roomActionSchema } from "@/uno/schema";
import { z } from "zod";
import { storedUnoAction, StorageError } from "@/uno/storage";
import { checkOrigin } from "@/uno/http";
import { notifyGroupMembers } from "@/uno/push";
import { formatSchedule } from "@/components/uno/schedule";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  try {
    const body = await request.text();
    if (body.length > 20000) throw new Error("Request too large");
    const input = roomActionSchema.parse(JSON.parse(body));
    const result = await storedUnoAction(input);
    if (input.action === "create" && input.groupId && "scheduled" in result && result.scheduled) {
      const { title, scheduledFor } = result;
      try {
        await notifyGroupMembers(input.groupId, input.uid ?? "", {
          title: "New game scheduled",
          body: `${title || "Game night"} · ${formatSchedule(scheduledFor)}`,
          url: "/",
        });
      } catch (error) {
        console.error("Group notify failed:", error);
      }
    }
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
