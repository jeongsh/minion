import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  className = "",
  containerClassName = "",
  ...props
}: ComponentProps<typeof Input> & { containerClassName?: string }) {
  return (
    <div className={"relative min-w-0 flex-1 " + containerClassName}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]"
      />
      <Input type="search" className={"pl-9 " + className} {...props} />
    </div>
  );
}
