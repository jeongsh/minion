import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/admin";

// robots.txt에서 /admin/을 막고 있지만, 외부 링크로 URL이 노출될 경우를 대비한 방어선.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return children;
}
