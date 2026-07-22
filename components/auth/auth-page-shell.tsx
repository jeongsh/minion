import flagCharacter from "@/assets/characters/flag-3.png";
import markerCharacter from "@/assets/characters/pen-4.png";
import Image from "next/image";

const AUTH_CHARACTER = {
  flag: flagCharacter,
  marker: markerCharacter,
} as const;

export function AuthPageShell({
  title,
  description,
  character = "marker",
  children,
}: {
  title: string;
  description: string;
  character?: keyof typeof AUTH_CHARACTER;
  children: React.ReactNode;
}) {
  const image = AUTH_CHARACTER[character];

  return (
    <main className="auth-page layout-wide flex min-h-[calc(100dvh-3.5rem)] items-start justify-center py-8 sm:min-h-[calc(100dvh-4rem)] sm:py-12">
      <section className="auth-page__shell my-auto grid w-full max-w-[760px] overflow-hidden rounded-3xl border border-[var(--ui-border)] bg-[var(--ui-surface)] md:grid-cols-[280px_minmax(0,1fr)]">
        <header className="auth-page__intro flex min-h-[220px] flex-col bg-[var(--auth-primary)] px-6 pb-0 pt-6 text-white md:min-h-[540px] md:px-7 md:pt-8">
          <p className="text-[13px] font-black tracking-[-0.03em] text-[var(--auth-point)]">MINION.</p>
          <h1 className="mt-3 text-[25px] font-black leading-tight tracking-[-0.04em] md:text-[30px] font-paperozi">{title}</h1>
          <p className="mt-2 max-w-[28rem] text-sm font-semibold leading-6 text-white/80">{description}</p>
          <Image
            src={image}
            alt=""
            sizes="(max-width: 767px) 112px, 240px"
            className="mt-auto h-28 w-full object-contain object-bottom md:h-60"
          />
        </header>
        <div className="auth-page__form flex min-w-0 flex-col justify-center p-6 sm:p-8 md:p-10">
          {children}
        </div>
      </section>
    </main>
  );
}
