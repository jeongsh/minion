import type { ReactNode } from "react";

export function EventFilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {children}
      {actions ? <div className="flex items-center gap-2 sm:ml-auto sm:gap-3">{actions}</div> : null}
    </div>
  );
}
