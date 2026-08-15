import Image from "next/image";
import type { ReactNode } from "react";

import megaphoneBuddy from "@/assets/characters/megapon-1.png";

export function ErrorState({
  code,
  title,
  body,
  action,
  digest,
}: {
  code: string;
  title: string;
  body: string;
  action: ReactNode;
  digest?: string;
}) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">{code}</p>
      <Image
        src={megaphoneBuddy}
        alt=""
        priority
        sizes="128px"
        className="mt-5 h-28 w-28 object-contain drop-shadow-[0_10px_20px_rgba(34,197,94,0.14)] sm:h-32 sm:w-32"
      />
      <h1 className="mt-4 font-paperozi text-[26px] leading-tight text-[var(--ui-ink)] sm:text-[30px]">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--ui-muted)]">{body}</p>
      {digest ? <p className="mt-3 font-mono text-xs text-[var(--ui-muted)]">digest: {digest}</p> : null}
      <div className="mt-6 flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row">{action}</div>
    </section>
  );
}
