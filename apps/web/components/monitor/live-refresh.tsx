"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isDemo } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Mantiene la vista "en vivo": se suscribe a Supabase Realtime (alerts / monitored_resources)
 * y re-renderiza los Server Components ante cambios; con un polling de respaldo.
 */
export function LiveRefresh({ tables = ["alerts", "monitored_resources"], intervalMs = 15000 }: {
  tables?: string[]; intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    if (isDemo) return () => clearInterval(timer);

    const supabase = getSupabaseBrowser();
    const channel = supabase.channel("svb-live");
    tables.forEach((table) =>
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh()));
    channel.subscribe();
    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [router, tables, intervalMs]);

  return (
    <span className="inline-flex items-center gap-2 text-xs text-fg-subtle">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ok" /> En vivo
    </span>
  );
}
