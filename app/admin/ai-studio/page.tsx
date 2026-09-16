import { Breadcrumb } from "@/components/layout/breadcrumb";
import { requireAdmin } from "@/lib/auth/admin";
import { AiStudio } from "./studio";

export const dynamic = "force-dynamic";

export default async function AiStudioPage() {
  const admin = await requireAdmin();
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-8 text-[var(--ui-ink)] sm:py-10">
      <header className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "AI 캐릭터 작업실" }]} />
        <h1 className="font-paperozi text-[28px] font-normal leading-tight">AI 캐릭터 작업실</h1>
        <p className="max-w-3xl text-base font-normal leading-7 text-[var(--ui-muted)]">뉴스·영상·SNS·커뮤니티 소재로 AI 캐릭터의 대화를 만듭니다. 원문 맥락과 초안을 검토한 뒤 게시하고, 댓글 예약과 실제 유저 답변을 관리하세요.</p>
      </header>
      <AiStudio storageKey={`minion:ai-studio:v1:${admin.id}`} generationAvailable={Boolean(process.env.OPENAI_API_KEY)} />
    </main>
  );
}
