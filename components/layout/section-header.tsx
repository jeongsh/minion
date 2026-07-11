export function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      ) : null}
      <h1 className="home-section-title mt-2 text-[28px] tracking-normal">
        {title}
      </h1>
    </div>
  );
}
