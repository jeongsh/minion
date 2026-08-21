import Image from "next/image";

export function BrandLogo({
  accentColor,
  className,
  priority = false,
}: {
  accentColor?: string;
  className: string;
  priority?: boolean;
}) {
  if (!accentColor) {
    return <Image src="/logo.svg" alt="MINION" width={171} height={39} className={className} priority={priority} />;
  }

  return (
    <span
      role="img"
      aria-label="MINION"
      className={`inline-block ${className}`}
      style={{
        aspectRatio: "171 / 39",
        backgroundColor: accentColor,
        maskImage: 'url("/logo.svg")',
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: 'url("/logo.svg")',
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
