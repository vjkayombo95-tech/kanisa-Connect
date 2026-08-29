import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useVisibleStaffServices } from "@/components/staff-mobile/StaffMobileExperience";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStaffMobileConfig } from "@/lib/staff-mobile-registry";

export function ChurchAdminCommandMenu() {
  const navigate = useNavigate();
  const { staffWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const workspaceConfig = getStaffMobileConfig(staffWorkspace);
  const { services } = useVisibleStaffServices(workspaceConfig);
  const results = useMemo(() => { const value = query.trim().toLocaleLowerCase(); return services.filter((service) => !value || `${service.label} ${service.id} ${service.group}`.toLocaleLowerCase().includes(value)); }, [query, services]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setOpen((current) => !current); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl overflow-hidden border-white/10 bg-[#0b0e13] p-0">
        <DialogHeader className="sr-only"><DialogTitle>Search workspace</DialogTitle><DialogDescription>Open an approved Church Admin service.</DialogDescription></DialogHeader>
        <label className="flex items-center gap-3 border-b border-white/10 px-4"><Search className="h-5 w-5 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search approved services…" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none" /></label>
        <div className="premium-scrollbar max-h-[min(55vh,calc(100dvh-7rem))] overflow-y-auto p-2">{results.map((service) => { const Icon = service.icon; return <button key={service.id} type="button" onClick={() => { setOpen(false); setQuery(""); navigate(service.route); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-white/70 hover:bg-white/[0.05] hover:text-white"><Icon className="h-4 w-4 text-primary" /><span className="flex-1">{service.label}</span><span className="text-xs text-white/35">{service.group}</span></button>; })}{!results.length ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">No approved service matches this search.</p> : null}</div>
      </DialogContent>
    </Dialog>
  );

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 text-left text-sm text-muted-foreground transition hover:border-primary/20 hover:text-foreground"><Search className="h-4 w-4" /><span className="flex-1">Search workspace</span><kbd className="rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-[10px]">Ctrl K</kbd></button>
    {typeof document === "undefined" ? dialog : createPortal(dialog, document.body)}
  </>;
}
