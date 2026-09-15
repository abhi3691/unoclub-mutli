import { listMyGroups } from "@/uno/groups";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const uid = new URL(request.url).searchParams.get("uid");
  if (!uid) return Response.json({ error: "Missing uid" }, { status: 400 });
  try {
    const groups = await listMyGroups(uid);
    return Response.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load your groups:", error);
    return Response.json(
      { error: "Unable to load your groups." },
      { status: 503 },
    );
  }
}
