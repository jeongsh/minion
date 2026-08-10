import { AtSign, Globe2, Play } from "lucide-react";

import { FanHeaderTooltip, fanHeaderIconButtonClass } from "@/components/fan/fan-header-control-styles";
import type { Team } from "@/lib/types";

export function FanOfficialLinks({ team }: { team: Team }) {
  const links = [
    {
      label: "공식 홈페이지",
      href: team.officialHomepageUrl,
      icon: <Globe2 size={16} aria-hidden="true" />,
    },
    {
      label: "공식 YouTube",
      href: team.officialYoutubeUrl,
      icon: <Play size={16} aria-hidden="true" />,
    },
    {
      label: "공식 X",
      href: team.officialXUrl,
      icon: <span className="text-[13px] font-black leading-none" aria-hidden="true">X</span>,
    },
    {
      label: "공식 Instagram",
      href: team.officialInstagramUrl,
      icon: <AtSign size={16} aria-hidden="true" />,
    },
  ].flatMap((item) => (item.href ? [{ ...item, href: item.href }] : []));

  if (!links.length) return null;

  return (
    <div className="flex items-center gap-2" aria-label={`${team.shortName} 공식 채널`}>
      {links.map((link, index) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${team.shortName} ${link.label}`}
          title={`${team.shortName} ${link.label}`}
          className={fanHeaderIconButtonClass}
        >
          {link.icon}
          <FanHeaderTooltip align={index === links.length - 1 ? "right" : "center"}>{link.label}</FanHeaderTooltip>
        </a>
      ))}
    </div>
  );
}
