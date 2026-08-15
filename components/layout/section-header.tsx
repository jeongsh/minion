export function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  const visibleEyebrow = eyebrow && !/[A-Za-z]/.test(eyebrow) ? eyebrow : null;

  return (
    <div className="max-w-3xl">
      {visibleEyebrow ? (
        <p className="text-sm font-semibold text-accent">{visibleEyebrow}</p>
      ) : null}
      <h1 className="home-section-title mt-2 text-[length:var(--ui-title-size)] tracking-normal md:text-[28px]">
        {title}
      </h1>
    </div>
  );
}
