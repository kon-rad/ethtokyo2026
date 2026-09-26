import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-black disabled:bg-gray-400",
  secondary: "border border-line bg-surface text-foreground hover:bg-gray-50 disabled:text-gray-400",
  ghost: "text-foreground hover:bg-gray-100",
  danger: "border border-red-200 bg-surface text-danger hover:bg-red-50",
};

export function Button({
  variant = "primary",
  className,
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
        variants[variant],
        className,
      )}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("rounded-2xl border border-line bg-surface p-6", className)} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={cx(inputBase, "resize-y", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputBase, props.className)} />;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    info: "bg-indigo-50 text-indigo-700",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-indigo-100 bg-indigo-50 text-indigo-900",
    error: "border-red-100 bg-red-50 text-red-800",
    success: "border-emerald-100 bg-emerald-50 text-emerald-800",
  };
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function SeatsBar({ taken, min, max }: { taken: number; min: number; max: number }) {
  const pct = Math.min(100, (taken / max) * 100);
  const minPct = (min / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={cx("h-full rounded-full", taken >= min ? "bg-emerald-500" : "bg-gray-900")} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-gray-400" style={{ left: `${minPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>
          {taken} of {max} seats
        </span>
        <span>{taken >= min ? "Minimum reached ✓" : `${min - taken} more to reach minimum`}</span>
      </div>
    </div>
  );
}

export { cx };
