import type { ReactNode } from "react";

type EventFilterBarProps = { children: ReactNode; actions?: ReactNode };

export function EventFilterHeader(props: EventFilterBarProps) {
  return (
    <header data-ad-secondary-header className="mt-2 hidden border-b border-[var(--ui-border)] bg-[var(--page-background)] lg:sticky lg:top-[var(--ui-header-height)] lg:z-30 lg:block">
      <div className="layout-wide flex items-center py-2.5">
        <EventFilterBar {...props} />
      </div>
    </header>
  );
}

export function EventFilterBar({ children, actions }: EventFilterBarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
      {children}
      {actions ? <div className="flex items-center gap-2 sm:ml-auto sm:gap-3">{actions}</div> : null}
    </div>
  );
}
