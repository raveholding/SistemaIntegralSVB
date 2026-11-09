"use client";
import { useRef, useState, useTransition } from "react";
import { FileUp, ShieldCheck } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui/button";
import { isDemo } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Target { id: string; code: string; client_name: string; tenant_id?: string; client_id?: string; versions: number }

async function sha256Hex(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sube una nueva versión PDF:
 *  1) hash SHA-256 en el navegador  2) upload al bucket privado `contracts`
 *  3) RPC add_contract_version (valida ruta, permisos y registra en auditoría)
 */
export function ContractUploader({ contracts, tenantId, clientIds }: {
  contracts: Target[]; tenantId: string; clientIds: Record<string, string>;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    const note = new FormData(e.currentTarget).get("note") as string;
    if (!file) return setMsg({ ok: false, text: "Seleccione un PDF" });
    if (file.type !== "application/pdf") return setMsg({ ok: false, text: "Sólo se aceptan PDF" });
    if (file.size > 25 * 1024 * 1024) return setMsg({ ok: false, text: "Máximo 25 MB" });

    start(async () => {
      const hash = await sha256Hex(file);
      const c = contracts.find((x) => x.id === contractId)!;
      const path = `${tenantId}/${clientIds[contractId]}/${contractId}/v${c.versions + 1}-${hash.slice(0, 8)}.pdf`;
      if (isDemo) return setMsg({ ok: true, text: `Demo: v${c.versions + 1} · sha256 ${hash.slice(0, 16)}…` });

      const db = getSupabaseBrowser();
      const up = await db.storage.from("contracts").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (up.error) return setMsg({ ok: false, text: up.error.message });
      const { error } = await db.rpc("add_contract_version", {
        p_contract: contractId, p_storage_path: path, p_sha256: hash, p_size: file.size, p_note: note || null,
      });
      if (error) return setMsg({ ok: false, text: error.message });
      setMsg({ ok: true, text: `Versión v${c.versions + 1} registrada · sha256 ${hash.slice(0, 16)}…` });
      window.location.reload();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Contrato">
        <select className={inputCls} value={contractId} onChange={(e) => setContractId(e.target.value)}>
          {contracts.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.client_name} (v{c.versions})</option>)}
        </select>
      </Field>
      <Field label="Archivo PDF" hint="Se calcula la huella SHA-256 antes de subir: cualquier alteración posterior es detectable.">
        <input ref={fileRef} type="file" accept="application/pdf"
          className="block w-full text-sm text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.06] file:px-3 file:py-2 file:text-fg" />
      </Field>
      <Field label="Nota de cambio">
        <input name="note" className={inputCls} placeholder="Ej.: ajuste de cláusula de SLA" />
      </Field>
      <Button disabled={pending || !contracts.length} className="w-full">
        <FileUp className="h-4 w-4" /> {pending ? "Subiendo…" : "Subir nueva versión"}
      </Button>
      {msg && (
        <p className={msg.ok ? "flex items-center gap-2 text-xs text-ok" : "text-xs text-crit"}>
          {msg.ok && <ShieldCheck className="h-4 w-4" />} {msg.text}
        </p>
      )}
    </form>
  );
}
