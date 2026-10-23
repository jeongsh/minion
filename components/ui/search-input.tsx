import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  className = "",
  containerClassName = "",
  submitButton = false,
  ...props
}: ComponentProps<typeof Input> & { containerClassName?: string; submitButton?: boolean }) {
  return (
    <div className={"relative min-w-0 flex-1 " + containerClassName}>
      {submitButton ? <button type="submit" aria-label="검색" className="absolute inset-y-0 left-0 flex w-9 items-center justify-center rounded-l-lg text-[var(--ui-muted)] focus-visible:outline-2 focus-visible:outline-accent"><Search size={16} aria-hidden="true" /></button> : <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]"
      />}
      <Input type="search" className={"pl-9 " + className} {...props} />
    </div>
  );
}
