"use client";

import { useActionState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEAM_LOGO_FILE_ACCEPT, TEAM_LOGO_MAX_BYTES } from "@/lib/team-logos";
import { updateInternationalTeamMediaAction } from "../actions";

export function TeamMediaForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState(updateInternationalTeamMediaAction, {});

  return (
    <form action={action} className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "저장 중" : "저장"}</Button>
        {state.error && <p role="alert">{state.error}</p>}
        {state.saved && <p role="status">팀 미디어를 저장했습니다.</p>}
      </div>
    </form>
  );
}

export function TeamLogoFileInput({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
      {label}
      <Input
        type="file"
        name={name}
        accept={TEAM_LOGO_FILE_ACCEPT}
        aria-describedby="team-logo-file-formats"
        className="py-1.5 file:mr-3 file:rounded file:bg-surface-muted file:px-2 file:py-1 file:text-sm"
        onChange={(event) => {
          const input = event.currentTarget;
          const tooLarge = (input.files?.[0]?.size ?? 0) > TEAM_LOGO_MAX_BYTES;
          input.setCustomValidity(tooLarge ? "로고 파일은 768KB 이하로 올려 주세요." : "");
          if (tooLarge) input.reportValidity();
        }}
      />
    </label>
  );
}
