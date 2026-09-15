"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { ensureSignedIn } from "@/firebase/client";
import type { UnoGame } from "./useUnoGame";

type Group = { id: string; name: string; memberCount: number };
type PushStatus = "default" | "granted" | "denied" | "unsupported";

type Props = Pick<UnoGame, "name">;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function Groups({ name }: Props) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator))
      setPushStatus("unsupported");
    else setPushStatus(Notification.permission as PushStatus);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      const user = await ensureSignedIn();
      const [groupsResponse, mineResponse] = await Promise.all([
        fetch("/api/uno/groups", { cache: "no-store" }),
        fetch(`/api/uno/groups/mine?uid=${encodeURIComponent(user.uid)}`, {
          cache: "no-store",
        }),
      ]);
      if (!groupsResponse.ok || !mineResponse.ok)
        throw new Error("Groups unavailable. Try again.");
      const groupsData = await groupsResponse.json();
      const mineData = await mineResponse.json();
      if (cancelled) return;
      setGroups(groupsData.groups);
      setMine(new Set((mineData.groups as { id: string }[]).map((g) => g.id)));
    })()
      .catch((error) => {
        if (!cancelled)
          setError(error instanceof Error ? error.message : "Unable to load groups.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, refresh]);

  async function join(groupId: string) {
    if (!name.trim()) {
      setError("Enter your display name above first.");
      return;
    }
    setBusyId(groupId);
    setError("");
    try {
      const user = await ensureSignedIn();
      const response = await fetch("/api/uno/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, name, groupId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to join group.");
      setMine((prev) => new Set(prev).add(groupId));
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, memberCount: g.memberCount + 1 } : g)),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to join group.");
    } finally {
      setBusyId(null);
    }
  }

  async function createGroup() {
    if (!name.trim() || !newGroupName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const user = await ensureSignedIn();
      const response = await fetch("/api/uno/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, name, groupName: newGroupName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create group.");
      setGroups((prev) => [data.group, ...prev]);
      setMine((prev) => new Set(prev).add(data.group.id));
      setNewGroupName("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function enableNotifications() {
    setError("");
    try {
      if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
        setPushStatus("unsupported");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setError("Push notifications aren't configured yet.");
        return;
      }
      const permission = await Notification.requestPermission();
      setPushStatus(permission as PushStatus);
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const user = await ensureSignedIn();
      const response = await fetch("/api/uno/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("Unable to save notification settings.");
    } catch {
      setError("Couldn't enable notifications on this browser.");
    }
  }

  return (
    <section className="groups-card">
      <button
        className="groups-heading"
        aria-expanded={open}
        aria-controls="groups-content"
        onClick={() => setOpen(!open)}
      >
        <Icon name="players" /> Groups <span>{open ? "Hide" : "View groups"}</span>
      </button>
      {open && (
        <div id="groups-content">
          <p>Join a group and get notified when it schedules a game.</p>
          {pushStatus === "granted" ? (
            <p className="groups-note">Notifications are on for this browser.</p>
          ) : pushStatus === "denied" ? (
            <p className="groups-note">
              Notifications are blocked. Allow them in your browser&apos;s site settings.
            </p>
          ) : pushStatus === "unsupported" ? null : (
            <button className="groups-notify" onClick={enableNotifications}>
              <Icon name="info" /> Enable game notifications
            </button>
          )}
          <div className="groups-create">
            <input
              maxLength={40}
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button
              disabled={creating || !name.trim() || !newGroupName.trim()}
              onClick={createGroup}
            >
              Create
            </button>
          </div>
          <button
            className="groups-refresh"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <Icon name="clockwise" /> Refresh
          </button>
          {loading ? (
            <p role="status">Loading groups…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : groups.length === 0 ? (
            <p>No groups yet. Start one above!</p>
          ) : (
            <ul className="groups-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <span>
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button disabled={busyId === g.id || mine.has(g.id)} onClick={() => join(g.id)}>
                    {mine.has(g.id) ? "Joined" : "Join"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
