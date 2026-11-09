import { cn } from "./cn";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-white/[0.06] bg-ink-850/80 shadow-card backdrop-blur", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: {
  title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-fg-muted">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export const CardBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5", className)} {...p} />
);
