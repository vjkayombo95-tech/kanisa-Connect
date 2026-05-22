import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Mail, Bell, CreditCard, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type PlatformSettingsRecord = {
  id: string;
  platform_name: string;
  support_email: string;
  platform_description: string;
  maintenance_mode: boolean;
  default_trial_days: number;
  grace_period_days: number;
  auto_expire_trials: boolean;
  allow_downgrades: boolean;
  welcome_email_subject: string;
  welcome_email_body: string;
  invite_email_subject: string;
  invite_email_body: string;
  notify_new_church_registration: boolean;
  notify_payment_received: boolean;
  notify_subscription_expiring: boolean;
  notify_system_errors: boolean;
};

const DEFAULT_SETTINGS = {
  platform_name: "Kanisa Connect",
  support_email: "support@kanisaconnect.app",
  platform_description: "Church management platform for modern congregations.",
  maintenance_mode: false,
  default_trial_days: 30,
  grace_period_days: 7,
  auto_expire_trials: true,
  allow_downgrades: true,
  welcome_email_subject: "Welcome to Kanisa Connect!",
  welcome_email_body: "Thank you for joining Kanisa Connect. Your church is now set up and ready to go.",
  invite_email_subject: "You've been invited to join a church on Kanisa Connect",
  invite_email_body: "You've been invited to join {church_name}. Click the link below to accept.",
  notify_new_church_registration: true,
  notify_payment_received: true,
  notify_subscription_expiring: true,
  notify_system_errors: true,
};

export default function PlatformSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(DEFAULT_SETTINGS);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as PlatformSettingsRecord | null;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        platform_name: settings.platform_name,
        support_email: settings.support_email,
        platform_description: settings.platform_description,
        maintenance_mode: settings.maintenance_mode,
        default_trial_days: settings.default_trial_days,
        grace_period_days: settings.grace_period_days,
        auto_expire_trials: settings.auto_expire_trials,
        allow_downgrades: settings.allow_downgrades,
        welcome_email_subject: settings.welcome_email_subject,
        welcome_email_body: settings.welcome_email_body,
        invite_email_subject: settings.invite_email_subject,
        invite_email_body: settings.invite_email_body,
        notify_new_church_registration: settings.notify_new_church_registration,
        notify_payment_received: settings.notify_payment_received,
        notify_subscription_expiring: settings.notify_subscription_expiring,
        notify_system_errors: settings.notify_system_errors,
      });
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async (partial: Partial<typeof DEFAULT_SETTINGS>) => {
      const payload = { ...form, ...partial };

      if (settings?.id) {
        const { error } = await supabase
          .from("platform_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) {
          throw error;
        }

        return;
      }

      const { error } = await supabase.from("platform_settings").insert(payload);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Unable to save settings", description: error.message, variant: "destructive" });
    },
  });

  const setField = <K extends keyof typeof DEFAULT_SETTINGS>(field: K, value: (typeof DEFAULT_SETTINGS)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold font-serif">Platform Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Loading platform configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure Kanisa Connect platform settings</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-secondary">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" /> General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input value={form.platform_name} onChange={(e) => setField("platform_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input value={form.support_email} onChange={(e) => setField("support_email", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Platform Description</Label>
                  <Textarea value={form.platform_description} onChange={(e) => setField("platform_description", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">Temporarily disable access for non-admins</p>
                </div>
                <Switch checked={form.maintenance_mode} onCheckedChange={(checked) => setField("maintenance_mode", checked)} />
              </div>
              <Button onClick={() => saveSettings.mutate({})} disabled={saveSettings.isPending}>
                {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Subscription Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Trial Days</Label>
                  <Input
                    type="number"
                    value={form.default_trial_days}
                    onChange={(e) => setField("default_trial_days", Number(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grace Period Days</Label>
                  <Input
                    type="number"
                    value={form.grace_period_days}
                    onChange={(e) => setField("grace_period_days", Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Auto-expire Trials</Label>
                  <p className="text-xs text-muted-foreground">Automatically expire trial subscriptions</p>
                </div>
                <Switch checked={form.auto_expire_trials} onCheckedChange={(checked) => setField("auto_expire_trials", checked)} />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Allow Downgrades</Label>
                  <p className="text-xs text-muted-foreground">Churches can downgrade their plan</p>
                </div>
                <Switch checked={form.allow_downgrades} onCheckedChange={(checked) => setField("allow_downgrades", checked)} />
              </div>
              <Button onClick={() => saveSettings.mutate({})} disabled={saveSettings.isPending}>
                {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Subscription Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Email Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Welcome Email Subject</Label>
                <Input value={form.welcome_email_subject} onChange={(e) => setField("welcome_email_subject", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Welcome Email Body</Label>
                <Textarea rows={4} value={form.welcome_email_body} onChange={(e) => setField("welcome_email_body", e.target.value)} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Invite Email Subject</Label>
                <Input value={form.invite_email_subject} onChange={(e) => setField("invite_email_subject", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Invite Email Body</Label>
                <Textarea rows={4} value={form.invite_email_body} onChange={(e) => setField("invite_email_body", e.target.value)} />
              </div>
              <Button onClick={() => saveSettings.mutate({})} disabled={saveSettings.isPending}>
                {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Templates
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" /> Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  key: "notify_new_church_registration" as const,
                  label: "New Church Registration",
                  desc: "Notify when a new church registers",
                },
                {
                  key: "notify_payment_received" as const,
                  label: "Payment Received",
                  desc: "Notify on successful payment",
                },
                {
                  key: "notify_subscription_expiring" as const,
                  label: "Subscription Expiring",
                  desc: "Alert before subscription expires",
                },
                {
                  key: "notify_system_errors" as const,
                  label: "System Errors",
                  desc: "Notify on system errors or failures",
                },
              ].map((notification) => (
                <div key={notification.key} className="flex items-center justify-between py-2">
                  <div>
                    <Label>{notification.label}</Label>
                    <p className="text-xs text-muted-foreground">{notification.desc}</p>
                  </div>
                  <Switch
                    checked={form[notification.key]}
                    onCheckedChange={(checked) => setField(notification.key, checked)}
                  />
                </div>
              ))}
              <Button onClick={() => saveSettings.mutate({})} disabled={saveSettings.isPending}>
                {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Notifications
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
