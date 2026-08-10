import Link from "next/link";

import type { AdminCommunitySanction, AdminUserReport } from "@/lib/data/community-admin";
import {
  dismissCommunityUserReportAction,
  liftCommunityUserSanctionAction,
  sanctionCommunityUserAction,
} from "./actions";

export function UserModerationPanel({
  reports,
  sanctions,
}: {
  reports: AdminUserReport[];
  sanctions: AdminCommunitySanction[];
}) {
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">사용자 신고 <span className="text-red-500">{reports.length}</span></h2>
        <p className="text-sm text-neutral-500">반복 괴롭힘과 도배처럼 계정 단위 검토가 필요한 신고입니다. 영구 제한은 커뮤니티 쓰기만 막고 기존 콘텐츠는 유지합니다.</p>
        {reports.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">미처리 사용자 신고가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reports.map((report) => (
              <li key={report.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/community/user/${report.targetUserId}`} className="font-bold underline-offset-2 hover:underline">{report.targetUserName ?? "알 수 없음"}</Link>
                  <span className="text-[13px] text-neutral-500">신고자 {report.reporterName ?? "알 수 없음"}</span>
                  <span className="text-[13px] text-neutral-500">{formatDate(report.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-800/50">{report.reason}</p>
                {(report.evidencePostId || report.evidenceCommentId) ? (
                  <p className="mt-2 text-[13px] text-neutral-500">근거: {report.evidencePostId ? `게시글 ${report.evidencePostId}` : `댓글 ${report.evidenceCommentId}`}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={sanctionCommunityUserAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="user_id" value={report.targetUserId} />
                    <input type="hidden" name="report_id" value={report.id} />
                    <input type="hidden" name="reason" value={report.reason} />
                    <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">영구 제한</button>
                  </form>
                  <form action={dismissCommunityUserReportAction}>
                    <input type="hidden" name="report_id" value={report.id} />
                    <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800">기각</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">영구 제한 계정</h2>
        {sanctions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">현재 영구 제한된 계정이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
            {sanctions.map((sanction) => (
              <li key={sanction.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/community/user/${sanction.userId}`} className="font-semibold underline-offset-2 hover:underline">{sanction.userName ?? "알 수 없음"}</Link>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-500">{sanction.reason} · {formatDate(sanction.bannedAt)}</p>
                </div>
                <form action={liftCommunityUserSanctionAction}>
                  <input type="hidden" name="sanction_id" value={sanction.id} />
                  <button type="submit" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800">제한 해제</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
