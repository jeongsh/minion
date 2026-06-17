import type { Player } from "@/lib/types";

export type PlayerSocialField =
  | "streamUrl"
  | "twitterUrl"
  | "instagramUrl"
  | "youtubeUrl"
  | "facebookUrl"
  | "discordUrl";

export type PlayerSocialLink = {
  id: PlayerSocialField;
  label: string;
  url: string;
};

const SOCIAL_LABELS: Record<PlayerSocialField, string> = {
  streamUrl: "방송",
  twitterUrl: "X",
  instagramUrl: "Instagram",
  youtubeUrl: "YouTube",
  facebookUrl: "Facebook",
  discordUrl: "Discord",
};

export function normalizeSocialUrl(
  value: string | null | undefined,
  kind: PlayerSocialField,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const handle = trimmed.replace(/^@/, "");

  switch (kind) {
    case "twitterUrl":
      return `https://x.com/${handle}`;
    case "instagramUrl":
      return `https://www.instagram.com/${handle}`;
    case "youtubeUrl":
      return handle.startsWith("UC") || handle.includes("/")
        ? `https://www.youtube.com/${handle.replace(/^\//, "")}`
        : `https://www.youtube.com/@${handle}`;
    case "facebookUrl":
      return `https://www.facebook.com/${handle}`;
    case "discordUrl":
      return trimmed.startsWith("discord.") ? `https://${trimmed}` : trimmed;
    case "streamUrl":
      if (trimmed.includes(".")) {
        return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      }
      return `https://www.twitch.tv/${handle}`;
    default:
      return trimmed;
  }
}

export function getPlayerSocialLinks(player: Pick<
  Player,
  | "streamUrl"
  | "twitterUrl"
  | "instagramUrl"
  | "youtubeUrl"
  | "facebookUrl"
  | "discordUrl"
>): PlayerSocialLink[] {
  const fields: PlayerSocialField[] = [
    "twitterUrl",
    "instagramUrl",
    "youtubeUrl",
    "facebookUrl",
    "discordUrl",
    "streamUrl",
  ];

  return fields
    .map((field) => {
      const url = player[field]?.trim();
      if (!url) return null;
      return { id: field, label: SOCIAL_LABELS[field], url };
    })
    .filter((item): item is PlayerSocialLink => !!item);
}
