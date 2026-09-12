import { Icon } from "./Icon";
import type { UnoGame } from "./useUnoGame";

type Props = Pick<UnoGame, "name" | "setRules">;
export function GameHeader({ name, setRules }: Props) {
  return (
    <header className="topbar">
      <a className="brand" href="/">
        uno<span>club</span>
        <i>
          <Icon name="dot" />
        </i>
      </a>
      <nav>
        <span className="nav-active">Play</span>
        <button onClick={() => setRules(true)}>How to play</button>
      </nav>
      <div className="header-right">
        <span className="online-dot" /> Made for game night{" "}
        <span className="profile">{name[0]?.toUpperCase() || "U"}</span>
      </div>
    </header>
  );
}
