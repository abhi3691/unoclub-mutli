import type { ReactNode } from "react";
export type MobileView = "play" | "room";
type Props = {
  view: MobileView;
  hasRoom: boolean;
  yourTurn: boolean;
  rulesOpen: boolean;
  onNavigate: (view: MobileView) => void;
  onRules: () => void;
};
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
export function MobileNavigation({
  view,
  hasRoom,
  yourTurn,
  rulesOpen,
  onNavigate,
  onRules,
}: Props) {
  return (
    <nav className="mobile-navigation" aria-label="Game navigation">
      <button
        aria-pressed={!rulesOpen && view === "play"}
        disabled={!hasRoom}
        onClick={() => onNavigate("play")}
      >
        <Icon>
          <rect x="6" y="3" width="13" height="18" rx="3" />
          <path d="M3 6v12a3 3 0 0 0 3 3m5-13h3m-3 4h3m-3 4h3" />
        </Icon>
        <span>Play</span>
        {yourTurn && <i className="nav-turn-dot" aria-label="Your turn" />}
      </button>
      <button
        aria-pressed={!rulesOpen && view === "room"}
        onClick={() => onNavigate("room")}
      >
        <Icon>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2" />
        </Icon>
        <span>Room</span>
      </button>
      <button aria-pressed={rulesOpen} onClick={onRules}>
        <Icon>
          <path d="M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v16" />
        </Icon>
        <span>Rules</span>
      </button>
    </nav>
  );
}
