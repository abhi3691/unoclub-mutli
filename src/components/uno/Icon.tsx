import type { ReactNode } from "react";
const paths = {
  trophy: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v5m-4 2h8m-7-2h6" />
    </>
  ),
  speaker: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  soundOff: (
    <>
      <path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6" />
    </>
  ),
  cards: (
    <>
      <rect x="8" y="3" width="12" height="17" rx="2" />
      <path d="M5 7H3v14h12v-1M12 8h4m-2-2v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowUpRight: <path d="M6 18 18 6M6 6h12v12" />,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  arrowLeft: <path d="M20 12H4m6-6-6 6 6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.01" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8" />
    </>
  ),
  clockwise: (
    <>
      <path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5" />
    </>
  ),
  counterclockwise: (
    <>
      <path d="M4 7v5h5M4 12a8 8 0 1 1 2 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M15 8V4H4v11h4" />
    </>
  ),
  players: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5v2" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="7" fill="currentColor" stroke="none" />,
  skip: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m6 18 12-12" />
    </>
  ),
  reverse: <path d="M4 8h16l-5-5M20 16H4l5 5" />,
  wild: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
} satisfies Record<string, ReactNode>;
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="uno-icon"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
