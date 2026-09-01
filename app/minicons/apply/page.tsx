import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MiniconTabs } from "../minicon-tabs";
import { MiniconSubmissionForm } from "./minicon-submission-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "미니콘 신청 · MINION",
  description: "직접 만든 미니콘 패키지를 MINION 커뮤니티에 공개할 수 있도록 검토 신청합니다.",
  robots: { index: false, follow: false },
};

type ApplicationRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  cover_url: string;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

type MiniconApplication = {
  id: string;
  name: string;
  description: string;
  status: string;
  coverUrl: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  itemCount: number;
};

async function listOwnApplications(userId: string): Promise<{
  applications: MiniconApplication[];
  error: string | null;
}> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("minicon_packs")
      .select("id, name, description, status, cover_url, created_at, submitted_at, reviewed_at, review_note")
      .eq("creator_id", userId)
      .eq("is_official", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[minicons] failed to load user applications", error.message);
      return { applications: [], error: "신청 내역을 불러오지 못했습니다." };
    }

    const rows = (data ?? []) as ApplicationRow[];
    if (rows.length === 0) return { applications: [], error: null };

    const packIds = rows.map((row) => row.id);
    const { data: itemRows, error: itemError } = await admin
      .from("minicon_items")
      .select("pack_id")
      .in("pack_id", packIds);

    if (itemError) {
      console.warn("[minicons] failed to load user application item counts", itemError.message);
      return { applications: [], error: "신청 내역을 불러오지 못했습니다." };
    }

    const counts = new Map<string, number>();
    for (const item of (itemRows ?? []) as { pack_id: string }[]) {
      counts.set(item.pack_id, (counts.get(item.pack_id) ?? 0) + 1);
    }

    return {
      applications: rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        coverUrl: row.cover_url,
        submittedAt: row.submitted_at ?? row.created_at,
        reviewedAt: row.reviewed_at,
        reviewNote: row.review_note,
        itemCount: counts.get(row.id) ?? 0,
      })),
      error: null,
    };
  } catch {
    return { applications: [], error: "신청 내역을 불러오지 못했습니다." };
  }
}

function applicationStatus(status: string) {
  switch (status) {
    case "pending_review":
      return { label: "검토 중", dotClassName: "bg-[var(--palette-green-butter-point)]" };
    case "published":
      return { label: "공개됨", dotClassName: "bg-[var(--palette-green-butter-main)]" };
    case "rejected":
      return { label: "반려됨", dotClassName: "bg-[var(--palette-tomato-butter-main)]" };
    case "retired":
      return { label: "공개 종료", dotClassName: "bg-[var(--ui-muted)]" };
    case "suspended":
      return { label: "이용 중지", dotClassName: "bg-[var(--palette-tomato-butter-main)]" };
    default:
      return { label: "작성 중", dotClassName: "bg-[var(--palette-celebration-main)]" };
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function MiniconApplyPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-5xl pb-20 pt-6 sm:pt-10">
        <MiniconTabs active="apply" />
        {!user ? (
          <section className="mt-5 rounded-lg bg-[var(--ui-surface-muted)] p-5 text-center">
            <p className="text-[16px] font-normal text-[var(--ui-muted)]">로그인 후 미니콘을 신청할 수 있습니다.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/login?next=/minicons/apply"
                className="flex min-h-11 items-center justify-center rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-5 text-[14px] font-medium text-[var(--ui-surface)]"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="flex min-h-11 items-center justify-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] px-5 text-[14px] font-medium text-[var(--ui-ink)]"
              >
                회원가입
              </Link>
            </div>
          </section>
        ) : <AuthenticatedApplicationContent userId={user.id} />}
      </div>
    </main>
  );
}

async function AuthenticatedApplicationContent({ userId }: { userId: string }) {
  const { applications, error } = await listOwnApplications(userId);
  const pendingApplicationCount = applications.filter((application) => application.status === "pending_review").length;

  return (
    <>
      <section className="mt-6" aria-labelledby="minicon-application-form-title">
        <h2 id="minicon-application-form-title" className="home-section-title text-[20px] text-[var(--ui-ink)]">
          새 미니콘 신청
        </h2>
        <div className="mt-3">
          <MiniconSubmissionForm pendingApplicationCount={pendingApplicationCount} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="my-minicon-applications-title">
        <div className="flex items-end justify-between gap-4">
          <h2 id="my-minicon-applications-title" className="home-section-title text-[20px] text-[var(--ui-ink)]">
            내 신청 내역
          </h2>
          <span className="text-[13px] font-normal text-[var(--ui-muted)]">총 {applications.length}건</span>
        </div>

        {error ? (
          <div className="mt-4 rounded-[var(--ui-card-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-10 text-center">
            <p className="text-[16px] font-normal text-[var(--ui-muted)]">{error}</p>
          </div>
        ) : applications.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {applications.map((application) => {
              const status = applicationStatus(application.status);
              return (
                <article
                  key={application.id}
                  className="rounded-lg bg-[var(--ui-surface)] p-3 sm:p-4"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    {/* 공개 버킷의 사용자 업로드라 Next 이미지 호스트를 사전 열거할 수 없다. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={application.coverUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-20 shrink-0 rounded-2xl bg-[var(--ui-surface-muted)] object-cover sm:h-24 sm:w-24"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-[16px] font-bold text-[var(--ui-ink)]">{application.name}</h3>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-text)]">
                          <span className={`h-2 w-2 rounded-full ${status.dotClassName}`} aria-hidden="true" />
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[16px] font-normal leading-6 text-[var(--ui-muted)]">
                        {application.description || "설명 없이 신청한 미니콘 패키지입니다."}
                      </p>
                      <p className="mt-3 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">
                        미니콘 {application.itemCount}개 · {formatDate(application.submittedAt)} 신청
                        {application.reviewedAt ? ` · ${formatDate(application.reviewedAt)} 처리` : ""}
                      </p>
                    </div>
                  </div>

                  {application.reviewNote ? (
                    <div className="mt-4 rounded-xl bg-[var(--ui-surface-muted)] p-4">
                      <p className="text-[13px] font-medium text-[var(--ui-muted)]">심사 안내</p>
                      <p className="mt-1 text-[16px] font-normal leading-6 text-[var(--ui-text)]">{application.reviewNote}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[var(--ui-card-radius)] border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-12 text-center">
            <p className="text-[16px] font-normal text-[var(--ui-muted)]">아직 신청한 미니콘이 없습니다.</p>
          </div>
        )}
      </section>
    </>
  );
}
