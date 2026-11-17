import { SegmentedControl } from "@/components/ui/tabs";

// 모바일 팀 채널은 소셜과 영상을 미디어 탭 하나로 묶으므로 화면 안에서 둘을 전환한다.
export function FanMediaSwitch({ teamSlug, active }: { teamSlug: string; active: "instagram" | "videos" }) {
  const base = `/fan/${encodeURIComponent(teamSlug)}`;
  return (
    <SegmentedControl
      items={[
        { key: "instagram", label: "소셜", href: `${base}/instagram` },
        { key: "videos", label: "영상", href: `${base}/videos` },
      ]}
      activeKey={active}
      ariaLabel="미디어 종류"
      className="lg:hidden"
      stretch
    />
  );
}
