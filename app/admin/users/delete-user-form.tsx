"use client";

import { deleteUserAction } from "./actions";

export function DeleteUserForm({ id }: { id: string }) {
  return <form action={deleteUserAction} onSubmit={(event) => {
    if (!window.confirm("이 계정을 영구 삭제할까요? 작성한 글과 댓글은 익명으로 남습니다.")) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id} />
    <button className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700">계정 영구 삭제</button>
  </form>;
}
