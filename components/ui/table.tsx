import type { ComponentProps, ReactNode } from "react";

function classes(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

/** 세트상세 기준의 외곽선, 표면, 간격과 스크롤을 모든 표에서 공유한다. */
export function Table({
  className,
  containerClassName,
  framed = true,
  ...props
}: ComponentProps<"table"> & {
  containerClassName?: string;
  /** 이미 외곽선이 있는 콘텐츠 안에서는 중복 프레임을 생략한다. */
  framed?: boolean;
}) {
  return (
    <div
      className={classes(
        "minion-table-scroll w-full min-w-0 overflow-x-auto bg-[var(--ui-surface)]",
        framed ? "rounded-lg border border-[var(--ui-border)]" : undefined,
        containerClassName,
      )}
    >
      <table
        className={classes(
          "minion-table w-full border-collapse text-left text-sm font-normal not-italic leading-5 tabular-nums text-[var(--ui-text)]",
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
        "bg-[var(--ui-card-bg)] text-[var(--ui-muted)]",
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
        "divide-y divide-[var(--ui-card-divider)] bg-[var(--ui-surface)] [&>tr:hover]:bg-[var(--ui-surface-muted)]",
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
        "align-middle transition-colors",
        className,
      )}
      {...props}
    />
  );
}
export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
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
