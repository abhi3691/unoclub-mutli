import type { UnoGame } from "./useUnoGame";

type Props = Pick<
  UnoGame,
  "mic" | "muted" | "voiceStatus" | "toggleVoice" | "toggleMute"
>;
export function VoicePanel({ mic, muted, voiceStatus, toggleVoice, toggleMute }: Props) {
  return (
    <section className="voice-card">
      <div className="voice-title">
        <span className="voice-icon">♫</span>
        <div>
          <h3>Good games sound better.</h3>
          <p>{mic ? voiceStatus : "Talk, laugh, call out that +4."}</p>
        </div>
      </div>
      <div className="voice-controls">
        <span>
          Voice chat <small>{mic ? "ENABLED" : "OPTIONAL"}</small>
        </span>
        <button
          role="switch"
          aria-checked={mic}
          aria-label="Enable voice chat"
          className={`switch ${mic ? "on" : ""}`}
          onClick={toggleVoice}
        >
          <span />
        </button>
      </div>
      {mic && (
        <button className="mute" onClick={toggleMute}>
          {muted ? "Unmute microphone" : "Mute microphone"}
        </button>
      )}
      <small className="privacy">Your mic is off until you turn it on.</small>
    </section>
  );
}
