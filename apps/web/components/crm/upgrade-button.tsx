"use client";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changePlan, type ActionResult } from "@/app/(staff)/crm/actions";

export function UpgradeButton({ subscriptionId, planId, label, preview }: {
  subscriptionId: string; planId: string; label: string; preview: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changePlan, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="planId" value={planId} />
      <Button size="sm" variant="primary" disabled={pending || state?.ok} title={preview}>
        <Sparkles className="h-3.5 w-3.5" /> {pending ? "Aplicando…" : label}
      </Button>
      {state && <span className={state.ok ? "text-[11px] text-ok" : "text-[11px] text-crit"}>{state.message}</span>}
    </form>
  );
}
