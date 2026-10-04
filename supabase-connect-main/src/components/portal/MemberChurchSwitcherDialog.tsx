import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Church, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AvailableChurch } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type MemberChurchSwitcherDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churches: AvailableChurch[];
  activeChurchId: string | null;
  switchChurch: (churchId: string) => Promise<void>;
  onSwitchSuccess?: () => void;
};

export function MemberChurchSwitcherDialog({
  open,
  onOpenChange,
  churches,
  activeChurchId,
  switchChurch,
  onSwitchSuccess,
}: MemberChurchSwitcherDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const [switchingChurchId, setSwitchingChurchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeChurch = churches.find((church) => church.church_id === activeChurchId) ?? churches[0] ?? null;
  const isSwitching = !!switchingChurchId;

  const handleSwitch = async (churchId: string) => {
    if (churchId === activeChurchId || switchingChurchId) return;

    setSwitchingChurchId(churchId);
    setError(null);

    try {
      await switchChurch(churchId);
      onOpenChange(false);
      onSwitchSuccess?.();
    } catch {
      setError(t("church_switcher.error"));
    } finally {
      setSwitchingChurchId(null);
    }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{t("church_switcher.my_churches")}</DialogTitle>
          <DialogDescription id={descriptionId}>
            {t("church_switcher.current_church", {
              church: activeChurch?.church_name ?? t("church_switcher.fallback_church"),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {churches.map((church) => {
            const isActive = church.church_id === activeChurchId;
            const isThisSwitching = switchingChurchId === church.church_id;
            const churchName = church.church_name ?? t("church_switcher.fallback_church");

            return (
              <button
                key={church.membership_id}
                type="button"
                data-testid={`church-switcher-row-${church.church_id}`}
                data-church-id={church.church_id}
                aria-current={isActive ? "true" : undefined}
                aria-label={
                  isActive
                    ? t("church_switcher.current_church_aria", { church: churchName })
                    : t("church_switcher.choose_church_aria", { church: churchName })
                }
                disabled={isSwitching || isActive}
                onClick={() => void handleSwitch(church.church_id)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/30 hover:bg-muted/60",
                  isSwitching && "cursor-wait opacity-75",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70">
                  {isThisSwitching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isActive ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Church className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-snug">{churchName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {isActive ? t("church_switcher.current_badge") : t("church_switcher.member")}
                  </span>
                </span>
                {!isActive ? (
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {isThisSwitching ? t("church_switcher.switching") : t("church_switcher.choose")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {switchingChurchId ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {t("church_switcher.switching")}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSwitching}>
          {t("church_switcher.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );

  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
