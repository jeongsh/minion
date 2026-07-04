import { StaticRoutePage } from "@/components/domain/static-route-page";

export default function AdminStatsPage() {
  return (
    <StaticRoutePage
      eyebrow="관리자"
      eyebrowHref="/admin"
      title="스탯 입력"
    />
  );
}
