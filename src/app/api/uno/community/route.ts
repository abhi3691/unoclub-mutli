import { listCommunityGames } from "@/uno/storage";
export const runtime = "nodejs";
export async function GET() {
  try {
    const games = await listCommunityGames();
    return Response.json({ games }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load community games:", error);
    return Response.json(
      { error: "Community games unavailable. Please try again." },
      { status: 503 },
    );
  }
}
