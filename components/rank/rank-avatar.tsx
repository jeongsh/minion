import type { CSSProperties } from "react";

import { TIER_LABELS, type Tier } from "@/lib/rank/config";

const TIER_FINISHES: Record<
  Tier,
  { ring: string; medal: string; gem: string; shadow: string }
> = {
  iron: {
    ring: "linear-gradient(135deg, #a99b92 0%, #3b3537 42%, #756b67 72%, #c0b0a4 100%)",
    medal: "linear-gradient(145deg, #a99c94, #2f2b2f 58%, #756b67)",
    gem: "linear-gradient(145deg, #d8dde2, #626a73 48%, #20242a)",
    shadow: "rgba(54, 48, 49, 0.5)",
  },
  bronze: {
    ring: "linear-gradient(135deg, #e09a7d 0%, #713827 42%, #b86145 72%, #f0b092 100%)",
    medal: "linear-gradient(145deg, #efaa88, #743724 58%, #bd684d)",
    gem: "linear-gradient(145deg, #ffd1b8, #c26b4c 48%, #652716)",
    shadow: "rgba(117, 55, 36, 0.5)",
  },
  silver: {
    ring: "linear-gradient(135deg, #f3f7fb 0%, #738297 38%, #c5d2df 70%, #ffffff 100%)",
    medal: "linear-gradient(145deg, #f7fbff, #657589 58%, #c6d1dc)",
    gem: "linear-gradient(145deg, #ffffff, #a8c0d6 48%, #53687b)",
    shadow: "rgba(78, 93, 111, 0.48)",
  },
  gold: {
    ring: "linear-gradient(135deg, #ffe38a 0%, #9a5d0c 40%, #d99b27 70%, #fff0a3 100%)",
    medal: "linear-gradient(145deg, #ffe68d, #9b5a08 58%, #e1a128)",
    gem: "linear-gradient(145deg, #fff6a8, #ffc400 48%, #a96800)",
    shadow: "rgba(151, 91, 9, 0.52)",
  },
  platinum: {
    ring: "linear-gradient(135deg, #8ff5ff 0%, #087f9e 40%, #14c8e8 72%, #b2fbff 100%)",
    medal: "linear-gradient(145deg, #b8fbff, #087994 58%, #25cde8)",
    gem: "linear-gradient(145deg, #d9ffff, #00bce8 48%, #006f99)",
    shadow: "rgba(0, 128, 157, 0.48)",
  },
  emerald: {
    ring: "linear-gradient(135deg, #9af7ba 0%, #08773c 40%, #24c967 72%, #c0ffd3 100%)",
    medal: "linear-gradient(145deg, #aef6c3, #087439 58%, #27c96a)",
    gem: "linear-gradient(145deg, #caffdb, #10b95a 48%, #006a32)",
    shadow: "rgba(5, 112, 54, 0.48)",
  },
  diamond: {
    ring: "linear-gradient(135deg, #84e8ff 0%, #374bb9 38%, #735af0 68%, #a8f3ff 100%)",
    medal: "linear-gradient(145deg, #a8f2ff, #3141a0 55%, #7968f4)",
    gem: "linear-gradient(145deg, #d7fbff, #287dff 45%, #5624c7)",
    shadow: "rgba(57, 60, 164, 0.52)",
  },
  master: {
    ring: "linear-gradient(135deg, #f5a2ff 0%, #7125a3 38%, #c43bd6 70%, #ffd0ff 100%)",
    medal: "linear-gradient(145deg, #f7b7ff, #6b2099 55%, #cf42dc)",
    gem: "linear-gradient(145deg, #ffd4ff, #c13ee8 45%, #67138d)",
    shadow: "rgba(112, 31, 145, 0.52)",
  },
  grandmaster: {
    ring: "linear-gradient(135deg, #ffb17d 0%, #8f1d12 38%, #ee4826 70%, #ffd096 100%)",
    medal: "linear-gradient(145deg, #ffc091, #8b1b0e 55%, #ed5128)",
    gem: "linear-gradient(145deg, #ffe3a6, #ff5b12 45%, #9e1907)",
    shadow: "rgba(139, 30, 15, 0.52)",
  },
  challenger: {
    ring:
      "conic-gradient(from 210deg, #39e4ff 0deg, #3b83ed 78deg, #a6f5ff 132deg, #ffe68a 190deg, #fff7c5 230deg, #45e9ff 292deg, #397ce5 360deg)",
    medal:
      "linear-gradient(145deg, #fff8c9 0%, #e7bd4d 42%, #41dff4 72%, #3178dc 100%)",
    gem:
      "radial-gradient(circle at 32% 24%, #ffffff 0 8%, transparent 9%), conic-gradient(from 210deg, #287ce9, #55ebff, #fff8bf, #e7b62f, #42a5f5, #287ce9)",
    shadow: "rgba(41, 186, 218, 0.58)",
  },
};

const SIZES = {
  sm: { avatar: 32, ring: 2.5, medal: 10 },
  md: { avatar: 40, ring: 3, medal: 12 },
  lg: { avatar: 96, ring: 4, medal: 22 },
} as const;

type RankAvatarProps = {
  tier: Tier;
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function RankAvatar({
  tier,
  src,
  alt = "",
  fallback = "MY",
  size = "sm",
  className = "",
}: RankAvatarProps) {
  const finish = TIER_FINISHES[tier];
  const dimensions = SIZES[size];
  const label = TIER_LABELS[tier];
  const medalOverlap = Math.max(2, Math.round(dimensions.medal * 0.18));

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={
        {
          width: dimensions.avatar,
          height: dimensions.avatar,
          "--rank-ring-width": `${dimensions.ring}px`,
          "--rank-medal-size": `${dimensions.medal}px`,
        } as CSSProperties
      }
      aria-label={`${label} 티어 프로필`}
      title={label}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: finish.ring,
          boxShadow: `0 0 0 1px rgba(11, 17, 27, 0.72), inset 0 1px 1px rgba(255,255,255,0.72), 0 2px 5px ${finish.shadow}`,
        }}
      />
      <span
        className="absolute overflow-hidden rounded-full border border-black/45 bg-[var(--ui-surface-muted)]"
        style={{ inset: "var(--rank-ring-width)" }}
      >
        {src ? (
          // Profile images may be freshly selected blob URLs, so next/image cannot safely optimize them.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-full w-full place-items-center font-medium text-[var(--ui-muted)]"
            style={{ fontSize: Math.max(10, Math.round(dimensions.avatar * 0.28)) }}
          >
            {fallback.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: -medalOverlap,
          width: "var(--rank-medal-size)",
          height: "calc(var(--rank-medal-size) * 1.08)",
          clipPath: "polygon(50% 0, 92% 28%, 88% 75%, 50% 100%, 12% 75%, 8% 28%)",
          background: finish.medal,
          filter: `drop-shadow(0 1px 1px ${finish.shadow})`,
        }}
      >
        <span
          className="absolute"
          style={{
            inset: "20% 22% 22%",
            clipPath: "polygon(50% 0, 92% 32%, 78% 82%, 50% 100%, 22% 82%, 8% 32%)",
            background: finish.gem,
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.72)",
          }}
        />
      </span>
    </span>
  );
}
