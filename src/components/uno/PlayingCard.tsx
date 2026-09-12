import { Icon } from "./Icon";
import type { Card } from "@/uno/types";
const symbol = (value: string) =>
  value === "skip" || value === "reverse" || value === "wild" ? (
    <Icon name={value} />
  ) : (
    value
  );
export function PlayingCard({
  card,
  back = false,
  onClick,
  disabled = false,
}: {
  card?: Card;
  back?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      data-card-id={card?.id}
      disabled={disabled}
      onClick={onClick}
      className={`playing-card ${back ? "back" : card?.color}`}
      aria-label={back ? "Draw a card" : `${card?.color} ${card?.value}`}
    >
      <span className="corner">{back ? "" : symbol(card?.value ?? "")}</span>
      <span className="oval">
        {back ? (
          <b>
            UNO<span>CLUB</span>
          </b>
        ) : (
          symbol(card?.value ?? "")
        )}
      </span>
      <span className="corner bottom">{back ? "" : symbol(card?.value ?? "")}</span>
    </button>
  );
}
