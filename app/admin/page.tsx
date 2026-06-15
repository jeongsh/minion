import { StaticRoutePage } from "@/components/domain/static-route-page";
import { adminNavItems } from "@/lib/navigation";

export default function AdminPage() {
  return (
    <StaticRoutePage
      eyebrow="관리자"
      title="운영 입력 대시보드"
      items={adminNavItems}
      notice={false}
    />
  );
}
