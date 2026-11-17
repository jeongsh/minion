"use client";

import { Button } from "@/components/ui/button";

export default function MessagesError({ reset }: { reset: () => void }) {
  return <div className="space-y-4 py-12 text-center"><p role="alert" className="text-base text-[var(--ui-muted)]">쪽지를 불러오지 못했습니다.</p><Button onClick={reset}>다시 시도</Button></div>;
}
