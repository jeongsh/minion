import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Megaphone, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "정책 안내",
  description: "MINION의 이용약관, 개인정보처리방침과 광고·제휴 안내입니다.",
};

const POLICIES = [
  { href: "/privacy", title: "개인정보처리방침", description: "수집 정보, 이용 목적, 보관 기간과 이용자 권리를 안내합니다.", icon: ShieldCheck },
  { href: "/terms", title: "이용약관", description: "서비스 이용, 회원 콘텐츠, LP와 커뮤니티 운영 기준을 안내합니다.", icon: FileText },
  { href: "/advertising", title: "광고 및 제휴 문의", description: "광고 지면, 표시 원칙과 제휴 문의 방법을 안내합니다.", icon: Megaphone },
];

export default function PoliciesPage() {
  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide pb-20 pt-6 sm:pt-10">
        <PageHeader title="정책 안내" />
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ui-muted)]">MINION이 어떤 기준으로 서비스를 운영하고 정보를 처리하는지 확인할 수 있습니다.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {POLICIES.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 transition hover:-translate-y-0.5 hover:bg-[var(--ui-surface-muted)]">
              <Icon size={22} className="text-[var(--ui-ink)]" />
              <h2 className="mt-5 text-lg font-black text-[var(--ui-ink)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ui-muted)]">{description}</p>
              <span className="mt-5 inline-block text-sm font-bold text-[var(--ui-ink)]">확인하기 →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
