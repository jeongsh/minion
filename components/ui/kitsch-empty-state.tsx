import megapon from "@/assets/characters/megapon-1.png";
import marker from "@/assets/characters/pen-4.png";
import flag from "@/assets/characters/flag-4.png";

const CHARACTER_IMAGE = {
  megapon,
  marker,
  flag,
} as const;

type KitschCharacter = keyof typeof CHARACTER_IMAGE;

export function KitschEmptyState({
  character = "marker",
  title,
  body,
  action,
  compact = false,
  animated = false,
  plain = false,
  className = "",
}: {
  character?: KitschCharacter;
  title: string;
  body?: string;
  action?: React.ReactNode;
  compact?: boolean;
  animated?: boolean;
  plain?: boolean;
  className?: string;
}) {
  const image = CHARACTER_IMAGE[character];

  return (
    <div
      className={`${plain ? "" : "kitsch-empty-state rounded-2xl border-2 border-dashed border-[var(--ui-border)]"} grid place-items-center px-5 text-center ${
        compact ? "min-h-28 py-5" : "min-h-40 py-10"
      } ${className}`}
    >
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <img
          src={image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className={`kitsch-empty-state__character ${compact ? "h-14 w-14" : "h-20 w-20"} object-contain ${
            animated ? "kitsch-empty-state__character--animated" : ""
          }`}
        />
        <p className={`font-paperozi text-[17px] text-[var(--ui-ink)] ${compact ? "text-[15px]" : ""}`}>
          {title}
        </p>
        {body ? <p className="mt-1.5 text-sm font-normal leading-6 text-[var(--ui-muted)]">{body}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
