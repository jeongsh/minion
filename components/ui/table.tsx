import type { ComponentProps, ReactNode } from "react";

function classes(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

/** 모든 데이터 표의 스크롤, 표면, 타이포그래피를 공유한다. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="minion-table-scroll w-full min-w-0 overflow-x-auto">
      <table
        className={classes(
          "minion-table w-full border-collapse text-left text-sm font-normal text-[var(--ui-text)]",
          className,
        )}
        {...props}
      />
    </div>
  );
}
export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={classes(
        "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]",
        className,
      )}
      {...props}
    />
  );
}
export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={classes(
        "divide-y divide-[var(--ui-card-divider)] bg-[var(--ui-surface)]",
        className,
      )}
      {...props}
    />
  );
}
export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={classes(
        "align-middle transition-colors hover:bg-[var(--ui-card-hover)]",
        className,
      )}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={classes(
        "h-10 whitespace-nowrap px-3 py-2 text-sm font-medium",
        className,
      )}
      {...props}
    />
  );
}
export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={classes("h-12 px-3 py-2 text-sm font-normal", className)}
      {...props}
    />
  );
}

export function TableValue({
  value,
  detail,
}: {
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="grid gap-0.5 whitespace-nowrap leading-5 tabular-nums">
      <span>{value}</span>
      {detail != null ? (
        <span className="text-[13px] font-normal text-[var(--ui-muted)]">
          {detail}
        </span>
      ) : null}
    </div>
  );
}
