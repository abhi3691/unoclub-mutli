import { db } from "@/firebase/admin";
export const runtime = "nodejs";
export async function GET() {
  try {
    const snapshot = await db()
      .collection("unoLeaderboard")
      .orderBy("wins", "desc")
      .limit(50)
      .get();
    const players = snapshot.docs.map((doc) => {
      const data = doc.data();
      const wins = Number(data.wins) || 0;
      const games = Number(data.games) || 0;
      return {
        name: String(data.name || "Player"),
        wins,
        games,
        winRate: games ? Math.round((wins / games) * 100) : 0,
      };
    });
    return Response.json({ players }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Leaderboard unavailable. Please try again." },
      { status: 503 },
    );
  }
}
