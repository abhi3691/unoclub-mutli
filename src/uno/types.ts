export type Color = "red" | "yellow" | "green" | "blue";
export type Card = { id: string; color: Color | "wild"; value: string };
export type Signal = {
  id: number;
  from: string;
  to: string;
  data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
};
export type Snapshot = {
  revision: number;
  pendingDraw: number;
  drawnThisTurn: boolean;
  code: string;
  self: string;
  host: string;
  public: boolean;
  phase: "lobby" | "playing" | "finished";
  players: {
    id: string;
    name: string;
    count: number;
    voice: boolean;
    connected: boolean;
  }[];
  hand: Card[];
  top: Card | null;
  color: Color;
  turn: string;
  direction: number;
  winner: string | null;
  standings: string[];
  matchOver: boolean;
  log: string[];
  signals: Signal[];
};
