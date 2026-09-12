import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function FeedbackToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), 6000);
    return () => window.clearTimeout(timer);
  }, [paused, closing]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onDismiss, 200);
    return () => window.clearTimeout(timer);
  }, [closing, onDismiss]);
  return (
    <div
      className={`feedback-toast ${closing ? "is-closing" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name="info" />
      <p role="status" aria-live="polite" aria-atomic="true">
        {message}
      </p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setClosing(true)}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
