import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AudioSettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Audio Settings</h2>
        <p className="text-sm text-muted-foreground">Processing settings are managed in the separate audio engine configuration.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Engine Integration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Setting label="Execution model" value="External Python pipeline" />
            <Setting label="WhisperX" value="Managed by engine" />
            <Setting label="Direct browser processing" value="Disabled" />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Storage Buckets</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["audio", "audio-reports", "audio-indexes", "audio-transcripts", "audio-alignments"].map((bucket) => (
              <Badge key={bucket} variant="outline">{bucket}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

