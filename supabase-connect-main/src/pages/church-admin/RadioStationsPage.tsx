import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchPermission } from "@/hooks/use-church-permission";
import { useToast } from "@/hooks/use-toast";
import { fetchChurchRadioCatalogue, setChurchRadioSelection, type ChurchRadioCatalogueEntry } from "@/lib/church-radio";

export default function RadioStationsPage() {
  const { churchId } = useAuth();
  const { allowed, isLoading: permissionLoading } = useChurchPermission("radio", "manage");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["church-radio-directory", churchId];
  const stations = useQuery({ queryKey, queryFn: () => fetchChurchRadioCatalogue(churchId!), enabled: Boolean(churchId && allowed) });
  const save = useMutation({
    mutationFn: ({ station, enabled, featured = station.isFeatured, order = station.sortOrder }: { station: ChurchRadioCatalogueEntry; enabled: boolean; featured?: boolean; order?: number }) => setChurchRadioSelection(churchId!, station.id, enabled, featured, order),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey }); toast({ title: "Mpangilio wa Radio umehifadhiwa" }); },
    onError: (error) => toast({ title: "Imeshindikana kuhifadhi", description: error instanceof Error ? error.message : "Jaribu tena.", variant: "destructive" }),
  });
  if (permissionLoading) return null;
  if (!allowed) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Huna ruhusa ya kusimamia Radio Live.</CardContent></Card>;
  return <main className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-xs font-extrabold tracking-[0.18em] text-red-500">RADIO LIVE</p><h1 className="mt-2 text-3xl font-bold">Chagua radio za waumini</h1><p className="mt-2 text-sm text-muted-foreground">Washa radio zilizoidhinishwa, chagua radio kuu, na panga mpangilio wake.</p></header>
    <div className="space-y-3">{stations.data?.map((station, index) => <Card key={station.id}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-red-500/10">{station.logoUrl ? <img src={station.logoUrl} alt="" className="h-full w-full object-cover" /> : <Radio className="h-6 w-6 text-red-500" />}</span>
      <div className="min-w-0 flex-1"><h2 className="font-bold">{station.name}</h2><p className="text-sm text-muted-foreground">{station.description || "Radio iliyoidhinishwa na Kanisa Connect"}</p><p className="mt-1 text-xs font-bold text-emerald-600">✓ IMEIDHINISHWA</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={station.enabled ? "default" : "outline"} disabled={save.isPending} onClick={() => save.mutate({ station, enabled: !station.enabled, featured: station.enabled ? false : station.isFeatured, order: station.sortOrder || index })}>{station.enabled ? "ON" : "OFF"}</Button>
        <Button variant={station.isFeatured ? "secondary" : "outline"} disabled={!station.enabled || save.isPending} onClick={() => save.mutate({ station, enabled: true, featured: true })}>{station.isFeatured ? "Radio kuu" : "Weka kuwa kuu"}</Button>
        <label className="flex items-center gap-2 text-xs font-semibold">Mpangilio<input aria-label={`Mpangilio wa ${station.name}`} type="number" min="0" defaultValue={station.sortOrder || index} className="h-10 w-16 rounded-md border bg-background px-2" onBlur={(event) => save.mutate({ station, enabled: station.enabled, order: Number(event.target.value) })} /></label>
      </div>
    </CardContent></Card>)}
    {!stations.isLoading && !stations.data?.length ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Hakuna radio iliyoidhinishwa kwenye katalogi kwa sasa.</p> : null}</div>
  </main>;
}
