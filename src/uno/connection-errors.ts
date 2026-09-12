export class RoomRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function isExpiredSession(error: unknown): boolean {
  return (
    error instanceof RoomRequestError &&
    /room not found|session expired/i.test(error.message)
  );
}
export function isRetryableRequest(error: unknown): boolean {
  return (
    !(error instanceof RoomRequestError) ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
}
export function listenerFailure(error: unknown): { retry: boolean; message: string } {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("permission-denied"))
    return {
      retry: false,
      message:
        "Live updates are blocked by Firebase permissions. Check the deployed Firestore rules.",
    };
  if (code.includes("failed-precondition"))
    return {
      retry: false,
      message:
        "Firebase live updates need configuration. Check the Firebase project and deployed rules.",
    };
  return { retry: true, message: "Live updates interrupted. Reconnecting…" };
}
