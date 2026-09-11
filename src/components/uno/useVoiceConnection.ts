"use client";
import { useCallback, useRef, useState, type RefObject } from "react";
import type { Snapshot } from "@/uno/types";
import type { RoomRequest } from "./useUnoGame";
export function useVoiceConnection(request: RoomRequest, cursor: RefObject<number>) {
  const [mic, setMic] = useState(false),
    [muted, setMuted] = useState(false),
    [voiceStatus, setVoiceStatus] = useState("Voice is off");
  const stream = useRef<MediaStream | null>(null),
    peers = useRef(new Map<string, RTCPeerConnection>()),
    audios = useRef(new Map<string, HTMLAudioElement>()),
    pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const stopVoice = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    peers.current.forEach((p) => p.close());
    peers.current.clear();
    audios.current.forEach((a) => {
      a.pause();
      a.srcObject = null;
    });
    audios.current.clear();
    setMic(false);
    setVoiceStatus("Voice is off");
  }, []);
  const connect = useCallback(
    (id: string) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          // Public demo TURN relay: without one, any pair behind a symmetric NAT
          // or a firewall that blocks direct UDP (common on mobile/corporate
          // networks) can never complete the connection over STUN alone.
          {
            urls: [
              "turn:openrelay.metered.ca:80",
              "turn:openrelay.metered.ca:443",
              "turn:openrelay.metered.ca:443?transport=tcp",
            ],
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      });
      peers.current.set(id, pc);
      stream.current?.getTracks().forEach((t) => pc.addTrack(t, stream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate)
          void request("signal", {
            to: id,
            data: { candidate: e.candidate.toJSON() },
          }).catch(() => {});
      };
      pc.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0];
        audio.autoplay = true;
        audios.current.set(id, audio);
        void audio
          .play()
          .catch(() => setVoiceStatus("Click the microphone to reconnect audio"));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setVoiceStatus("Connected to voice");
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          setVoiceStatus("Reconnecting voice…");
          pc.close();
          if (peers.current.get(id) === pc) peers.current.delete(id);
          audios.current.get(id)?.pause();
          audios.current.delete(id);
        }
      };
      return pc;
    },
    [request],
  );

  const syncVoice = useCallback(
    async (s: Snapshot) => {
      for (const [id, pc] of peers.current)
        if (!s.players.some((p) => p.id === id && p.voice)) {
          pc.close();
          peers.current.delete(id);
          audios.current.get(id)?.pause();
          audios.current.delete(id);
        }
      if (stream.current) {
        for (const sig of s.signals) {
          cursor.current = Math.max(cursor.current, sig.id);
          const pc = peers.current.get(sig.from) ?? connect(sig.from);
          if (sig.data.description) {
            await pc.setRemoteDescription(sig.data.description);
            for (const candidate of pendingIce.current.get(sig.from) ?? [])
              await pc.addIceCandidate(candidate);
            pendingIce.current.delete(sig.from);
            if (sig.data.description.type === "offer") {
              await pc.setLocalDescription(await pc.createAnswer());
              await request("signal", {
                to: sig.from,
                data: { description: pc.localDescription },
              });
            }
          } else if (sig.data.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(sig.data.candidate);
            else
              pendingIce.current.set(sig.from, [
                ...(pendingIce.current.get(sig.from) ?? []),
                sig.data.candidate,
              ]);
          }
        }
        for (const p of s.players)
          if (p.voice && p.id !== s.self && s.self < p.id && !peers.current.has(p.id)) {
            const pc = connect(p.id);
            await pc.setLocalDescription(await pc.createOffer());
            await request("signal", {
              to: p.id,
              data: { description: pc.localDescription },
            });
          }
      }
    },
    [connect, request, cursor],
  );
  async function startVoice() {
    stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    setMic(true);
    setMuted(false);
    setVoiceStatus("Waiting for voice participants");
  }
  function toggleMute() {
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  }
  return { mic, muted, voiceStatus, stopVoice, syncVoice, startVoice, toggleMute };
}
