"use client";
import { useUnoGame } from "./useUnoGame";
import { GameHeader } from "./GameHeader";
import { GameTable } from "./GameTable";
import { RoomLobby } from "./RoomLobby";
import { VoicePanel } from "./VoicePanel";
import { GameDialog } from "./GameDialog";

export default function Uno() {
  const game = useUnoGame();
  const { room } = game;
  return (
    <div
      className={`uno-app ${room ? "has-room" : "no-room"} ${room?.phase === "playing" ? "in-game" : ""}`}
    >
      <GameHeader name={game.name} setRules={game.setRules} />
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">GOOD FRIENDS. WILD CARDS.</div>
            <h1>Your table. Your people.</h1>
            <p>A little luck. A little strategy. A whole lot of “draw four.”</p>
          </div>
          <span className="edition">
            THE CLASSIC, TOGETHER <span>2–8 PLAYERS · LIVE VOICE</span>
          </span>
        </div>
        <div className="game-layout">
          <GameTable
            name={game.name}
            room={room}
            busy={game.busy}
            uno={game.uno}
            setUno={game.setUno}
            setRules={game.setRules}
            setWild={game.setWild}
            act={game.act}
          />
          <aside>
            <RoomLobby
              room={room}
              name={game.name}
              setName={game.setName}
              code={game.code}
              setCode={game.setCode}
              tab={game.tab}
              setTab={game.setTab}
              busy={game.busy}
              act={game.act}
              error={game.error}
              setError={game.setError}
            />
            <VoicePanel
              mic={game.mic}
              muted={game.muted}
              voiceStatus={game.voiceStatus}
              toggleVoice={game.toggleVoice}
              toggleMute={game.toggleMute}
            />
            {room ? (
              <section className="activity">
                <h3>At the table</h3>
                {room.log.slice(0, 4).map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </section>
            ) : (
              <div className="side-quote">
                “Friendships may be tested.
                <br />
                Rematches are encouraged.”<span>THE UNO CLUB WAY</span>
              </div>
            )}
          </aside>
        </div>
        <footer className="bottom-footer">
          <span>
            uno club <span>·</span> A familiar game. A new way to hang out.
          </span>
          <span>Uno-style fan game · Not affiliated with Mattel</span>
        </footer>
      </main>
      <GameDialog
        rules={game.rules}
        wild={game.wild}
        setRules={game.setRules}
        setWild={game.setWild}
        busy={game.busy}
        act={game.act}
        uno={game.uno}
      />
    </div>
  );
}
