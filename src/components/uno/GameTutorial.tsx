import { useEffect, useState } from "react";
import { PlayingCard } from "./PlayingCard";
import { Icon } from "./Icon";
import type { Card } from "@/uno/types";
const lessons: {
  title: string;
  caption: string;
  tip: string;
  before: string;
  after: string;
  cards: [Card["color"], string][];
}[] = [
  {
    title: "Invite your table",
    caption:
      "Choose a name, create a room, and share its code. Or use Quick play to find a public table.",
    tip: "The host starts with 2–8 players. Everyone receives 7 cards.",
    before: "You + friends",
    after: "7 cards each",
    cards: [
      ["blue", "7"],
      ["red", "7"],
      ["green", "7"],
    ],
  },
  {
    title: "Match color or number",
    caption:
      "The discard is a red 5. You can play another red card, or a 5 of any color.",
    tip: "The NOW badge tells you when you can play. NEXT shows who follows you.",
    before: "Red 5 on the table",
    after: "Blue 5 is a match",
    cards: [
      ["red", "5"],
      ["blue", "5"],
    ],
  },
  {
    title: "Draw, then play or pass",
    caption:
      "No card to play? Draw one. If that new card is playable, you can play it or choose Pass.",
    tip: "If the drawn card is not playable, your turn ends automatically.",
    before: "Draw one card",
    after: "Playable? Play or pass",
    cards: [
      ["green", "3"],
      ["green", "8"],
    ],
  },
  {
    title: "Skip and reverse",
    caption: "Skip jumps over the next player. Reverse changes the direction of play.",
    tip: "Watch the player-order strip update after the card is played.",
    before: "A → B → C",
    after: "Skip: A → C · Reverse: A → C → B",
    cards: [
      ["red", "skip"],
      ["blue", "reverse"],
    ],
  },
  {
    title: "Stack a +2 penalty",
    caption:
      "In a two-player game, A plays +2. B must draw two and lose the turn, or play another +2.",
    tip: "If B stacks +2, A now faces four cards. A can stack again or take the total. With more players, the penalty follows the turn order.",
    before: "A plays +2",
    after: "B stacks +2 → A faces 4",
    cards: [
      ["red", "+2"],
      ["blue", "+2"],
    ],
  },
  {
    title: "Wild cards and +4",
    caption:
      "A wild lets you choose the active color. Start a Wild +4 only when you have no matching color.",
    tip: "An existing +4 penalty can always be answered with another +4. Choose a color each time. Never stack +2 on +4 or +4 on +2.",
    before: "A plays +4",
    after: "B stacks +4 → A faces 8",
    cards: [
      ["wild", "wild"],
      ["wild", "+4"],
    ],
  },
  {
    title: "Call UNO before your card",
    caption:
      "When you have two cards, press the yellow UNO buzzer before playing down to one.",
    tip: "Green means your call is ready. Forget to call and two penalty cards are added automatically.",
    before: "2 cards · Press UNO!",
    after: "UNO ready → Play → 1 card",
    cards: [
      ["yellow", "2"],
      ["red", "9"],
    ],
  },
  {
    title: "Finish first",
    caption:
      "Empty your hand to earn first place. Your name appears in the winner announcement.",
    tip: "With more players, the host can continue for the remaining places or finish rankings. A new game starts a fresh race.",
    before: "Play your last card",
    after: "You win!",
    cards: [["green", "1"]],
  },
];
export function GameTutorial() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lesson = lessons[step];
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step === lessons.length - 1) setPlaying(false);
      else setStep((value) => value + 1);
    }, 4000);
    return () => clearTimeout(timer);
  }, [playing, step]);
  function jump(index: number) {
    setStep(index);
    setPlaying(false);
  }
  return (
    <div className="visual-tutorial">
      <div className="eyebrow">THE CLUB RULEBOOK · VISUAL WALKTHROUGH</div>
      <h2>Your guide to game night.</h2>
      <div className="tutorial-chapters" aria-label="Tutorial chapters">
        {lessons.map((item, index) => (
          <button
            key={item.title}
            aria-label={`Step ${index + 1}: ${item.title}`}
            aria-current={index === step ? "step" : undefined}
            onClick={() => jump(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div key={step} className={`tutorial-stage scene-${step}`}>
        <span className="tutorial-scene-label">{lesson.before}</span>
        <div className="tutorial-cards" aria-label="Example cards">
          {lesson.cards.map(([color, value], index) => (
            <div
              className="tutorial-demo-card"
              key={index}
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <PlayingCard
                card={{ id: `tutorial-${step}-${index}`, color, value }}
                disabled
              />
            </div>
          ))}
        </div>
        {step === 6 && (
          <span className="tutorial-uno">
            UNO! <Icon name="check" />
          </span>
        )}
        {step === 7 && (
          <span className="tutorial-trophy">
            <Icon name="trophy" />
          </span>
        )}
        <strong className="tutorial-result">{lesson.after}</strong>
      </div>
      <div className="tutorial-caption" aria-live="polite" aria-atomic="true">
        <h3>
          {step + 1}. {lesson.title}
        </h3>
        <p>{lesson.caption}</p>
        <p className="tutorial-tip">{lesson.tip}</p>
      </div>
      <div className="tutorial-playback">
        <button disabled={step === 0} onClick={() => jump(step - 1)}>
          <Icon name="arrowLeft" /> Back
        </button>
        <button
          aria-pressed={playing}
          onClick={() => {
            if (!playing && step === lessons.length - 1) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : step === lessons.length - 1 ? "Replay tour" : "Play tour"}
        </button>
        <button disabled={step === lessons.length - 1} onClick={() => jump(step + 1)}>
          Next <Icon name="arrowRight" />
        </button>
      </div>
      <small className="tutorial-duration">
        Step {step + 1} of {lessons.length} · Auto-play: 4 seconds per step. Pause to
        read at your pace.
      </small>
    </div>
  );
}
