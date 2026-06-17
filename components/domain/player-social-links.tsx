import { getPlayerSocialLinks } from "@/lib/player-social";
import type { Player } from "@/lib/types";

function SocialIcon({ id }: { id: string }) {
  switch (id) {
    case "twitterUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "instagramUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zM18 6.3a1.2 1.2 0 1 1-1.2 1.2 1.2 1.2 0 0 1 1.2-1.2z" />
        </svg>
      );
    case "youtubeUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.6 12 4.6 12 4.6s-5.8 0-7.6.6a2.8 2.8 0 0 0-2 2A29.4 29.4 0 0 0 2 12a29.4 29.4 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.6 7.6.6 7.6.6s5.8 0 7.6-.6a2.8 2.8 0 0 0 2-2 29.4 29.4 0 0 0 .4-4.8 29.4 29.4 0 0 0-.4-4.8zM10 15.5v-7l6 3.5z" />
        </svg>
      );
    case "facebookUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M13.5 9.5V7.7c0-.8.2-1.2 1.1-1.2h1.9V3.5h-2.8c-2.7 0-3.9 1.3-3.9 3.8v2.2H7v3.3h2.8V20h3.7v-7.2h2.5l.3-3.3z" />
        </svg>
      );
    case "discordUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M18.9 5.2A16.4 16.4 0 0 0 14.8 4l-.2.4a14.8 14.8 0 0 1 3.6 1.8l-.1-.1A16 16 0 0 0 12 4a16 16 0 0 0-6.1 1.1l.2-.1a14.8 14.8 0 0 1 3.6-1.8L9.5 4a16.4 16.4 0 0 0-4.1 1.2C2.7 8.8 2 12.3 2.3 15.7a16.5 16.5 0 0 0 5 2.5l1.2-1.9a10.7 10.7 0 0 1-2.9-1.4l.7.5a11.1 11.1 0 0 0 9.4 0l.7-.5a10.7 10.7 0 0 1-2.9 1.4l1.2 1.9a16.5 16.5 0 0 0 5-2.5c.4-4.1-.5-7.5-3.1-10.5zM9.7 13.6c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7zm4.6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z" />
        </svg>
      );
    case "streamUrl":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
          <path d="M4 4h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        </svg>
      );
    default:
      return null;
  }
}

export function PlayerSocialLinks({
  player,
  className = "",
}: {
  player: Pick<
    Player,
    "streamUrl" | "twitterUrl" | "instagramUrl" | "youtubeUrl" | "facebookUrl" | "discordUrl"
  >;
  className?: string;
}) {
  const links = getPlayerSocialLinks(player);
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          title={link.label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:border-accent hover:text-accent"
        >
          <SocialIcon id={link.id} />
        </a>
      ))}
    </div>
  );
}
