import { ScriptsRunner } from "./scripts-runner";

export default function AdminScriptsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <section className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-accent">관리자</p>
        <h1 className="text-3xl font-semibold">스크립트 실행</h1>
        <p className="mt-1 text-sm text-muted">
          버튼을 눌러 각 스크립트를 실행합니다. 자동 재실행을 켜면 완료 후 설정한 시간(초)마다 반복 실행됩니다.
        </p>
      </section>
      <ScriptsRunner />
    </main>
  );
}
