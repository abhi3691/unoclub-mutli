"use client";
import { FeedbackToast } from "./FeedbackToast";
import { Icon } from "./Icon";

import { useGameSounds } from "./useGameSounds";
import { useState } from "react";
import { MobileNavigation, type MobileView } from "./MobileNavigation";
import { useUnoGame } from "./useUnoGame";
import { Leaderboard } from "./Leaderboard";
import { Community } from "./Community";
import { Groups } from "./Groups";
import { GameHeader } from "./GameHeader";
import { GameTable } from "./GameTable";
import { RoomLobby } from "./RoomLobby";
import { VoicePanel } from "./VoicePanel";
import { GameDialog } from "./GameDialog";

export default function Uno() {
  const game = useUnoGame();
  const { room } = game;
  const sounds = useGameSounds(room);
  const [mobileSelection, setMobileSelection] = useState<{
    code: string | null;
    view: MobileView;
  }>({ code: null, view: "room" });
  const roomKey = room ? `${room.code}:${room.phase}` : null;
  const mobileView =
    mobileSelection.code === roomKey ? mobileSelection.view : room ? "play" : "room";
  const yourTurn = room?.phase === "playing" && room.turn === room.self;
  function navigate(view: MobileView) {
    setMobileSelection({ code: roomKey, view });
    game.setRules(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return (
    <div
      data-mobile-view={mobileView}
      className={`uno-app ${room ? "has-room" : "no-room"} ${room?.phase === "playing" ? "in-game" : ""}`}
    >
      {game.error && (
        <FeedbackToast
          key={game.error}
          message={game.error}
          onDismiss={() => game.setError("")}
        />
      )}
      <GameHeader name={game.name} setRules={game.setRules} />
      <main>
        {!room && (
          <div className="mobile-welcome">
            <h1>Ready to play?</h1>
            <p>Enter a name, then find a table or invite friends.</p>
          </div>
        )}
        {room && mobileView !== "play" && yourTurn && (
          <button className="mobile-turn-banner" onClick={() => navigate("play")}>
            It’s your turn{" "}
            <span>
              Play a card <Icon name="arrowRight" />
            </span>
          </button>
        )}
        {room && mobileView !== "play" && (
          <div className="mobile-section-heading">
            <div>
              <small>
                ROOM {room.code} · {room.players.length}/8 PLAYERS
              </small>
              <h1>Your room</h1>
            </div>
            <button onClick={() => navigate("play")}>
              {yourTurn ? "Your turn — play" : "Back to game"} <Icon name="arrowRight" />
            </button>
          </div>
        )}
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
        {room?.phase === "lobby" && mobileView === "play" && (
          <section className="mobile-lobby-actions" aria-label="Get your table ready">
            <div>
              <strong>
                {room.players.length < 2
                  ? "Invite a friend to begin"
                  : `${room.players.length} players · Ready to deal`}
              </strong>
              <p>Start with 2 players. Up to 8 can join.</p>
            </div>
            <div className="mobile-lobby-buttons">
              <button onClick={() => navigate("room")}>Invite friends</button>
              {room.host === room.self ? (
                <button
                  className="deal-button"
                  disabled={game.busy || room.players.length < 2}
                  onClick={() => game.act("start")}
                >
                  Start game <Icon name="arrowRight" />
                </button>
              ) : (
                <span>Waiting for the host</span>
              )}
            </div>
          </section>
        )}
        {room?.phase === "finished" && mobileView === "play" && (
          <button className="mobile-round-button" onClick={() => navigate("room")}>
            Next round & room controls <Icon name="arrowRight" />
          </button>
        )}
        <div className="game-layout">
          <GameTable
            name={game.name}
            room={room}
            busy={game.busy}
            uno={game.uno}
            setUno={(value) => {
              game.setUno(value);
              if (value) sounds.play("uno");
            }}
            setRules={game.setRules}
            setWild={game.setWild}
            act={game.act}
          >
            <button
              type="button"
              className="board-sound"
              aria-pressed={sounds.enabled}
              onClick={sounds.toggle}
            >
              <Icon name={sounds.enabled ? "speaker" : "soundOff"} /> Sound{" "}
              {sounds.enabled ? "on" : "off"}
            </button>
            <VoicePanel
              mic={game.mic}
              muted={game.muted}
              voiceStatus={game.voiceStatus}
              toggleVoice={game.toggleVoice}
              toggleMute={game.toggleMute}
            />
          </GameTable>
          <aside>
            <Leaderboard />
            <Community name={game.name} busy={game.busy} act={game.act} />
            <Groups name={game.name} />
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
              setError={game.setError}
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
      <MobileNavigation
        view={mobileView}
        hasRoom={!!room}
        yourTurn={yourTurn}
        rulesOpen={game.rules}
        onNavigate={navigate}
        onRules={() => game.setRules(true)}
      />
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
