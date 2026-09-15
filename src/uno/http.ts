/** Rejects a request whose Origin header doesn't match its own Host — a basic CSRF guard. */
export function checkOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (request.headers.get("host") ?? new URL(request.url).host)
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  return null;
}
