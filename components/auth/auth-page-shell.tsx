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
    <main className="auth-page layout-wide flex min-h-[calc(100dvh-3.5rem)] items-start justify-center py-4 sm:min-h-[calc(100dvh-4rem)] sm:py-6 lg:py-8">
      <section className="auth-page__shell my-auto grid w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] lg:grid-cols-[280px_minmax(0,1fr)] lg:rounded-3xl">
        <header className="auth-page__intro flex min-h-[140px] flex-col bg-[var(--auth-primary)] px-5 py-5 text-white sm:min-h-[150px] md:min-h-[170px] lg:min-h-[540px] lg:px-7 lg:pb-0 lg:pt-8">
          <p className="text-[13px] font-black tracking-[-0.03em] text-[var(--auth-point)]">MINION.</p>
          <h1 className="mt-2 text-[22px] font-black leading-tight tracking-[-0.04em] sm:text-[24px] md:text-[26px] lg:mt-3 lg:text-[30px] font-paperozi">{title}</h1>
          <p className="mt-2 max-w-[28rem] text-sm font-semibold leading-6 text-white/80">{description}</p>
          <Image
            src={image}
            alt=""
            sizes="(max-width: 1023px) 96px, 240px"
            className="mt-auto h-24 w-full object-contain object-bottom lg:h-60"
          />
        </header>
        <div className="auth-page__form flex min-w-0 flex-col justify-center p-6 sm:p-8 md:p-10">
          {children}
        </div>
      </section>
    </main>
  );
}
