import { useRef, useState } from "react";
import type { UnoGame } from "./useUnoGame";

type Props = Pick<
  UnoGame,
  "mic" | "muted" | "voiceStatus" | "toggleVoice" | "toggleMute"
>;
export function VoicePanel({ mic, muted, voiceStatus, toggleVoice, toggleMute }: Props) {
  const pending = useRef(false);
  const [changing, setChanging] = useState(false);
  async function changeVoice() {
    if (pending.current) return;
    pending.current = true;
    setChanging(true);
    try {
      await toggleVoice();
    } finally {
      pending.current = false;
      setChanging(false);
    }
  }
  return (
    <section className="board-voice" aria-label="Table voice chat">
      <div className="board-voice-status">
        <strong>Voice chat · {mic ? (muted ? "Muted" : "On") : "Off"}</strong>
        <span role="status">
          {changing
            ? "Updating voice…"
            : mic
              ? voiceStatus
              : "Turn on to talk with your table"}
        </span>
      </div>
      <div className="board-voice-actions">
        {mic && (
          <button
            type="button"
            aria-pressed={muted}
            disabled={changing}
            onClick={toggleMute}
          >
            {muted ? "Unmute mic" : "Mute mic"}
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-label="Voice chat"
          aria-checked={mic}
          disabled={changing}
          onClick={changeVoice}
        >
          {changing ? "Please wait…" : mic ? "Turn off" : "Turn on voice"}
        </button>
      </div>
    </section>
  );
}
