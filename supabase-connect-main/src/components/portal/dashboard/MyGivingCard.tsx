import { HandCoins, History } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppLink } from "@/components/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTZSForLanguage } from "@/lib/currency";
import { normalizeAppLanguage } from "@/lib/localization";

import type { MemberHomeData } from "./types";
import { formatDate } from "./utils";

export function MyGivingCard({ home }: { home: MemberHomeData }) {
  const { t, i18n } = useTranslation();
  const language = normalizeAppLanguage(i18n.language) ?? "en";

  return (
    <Card className="rounded-[28px] border-primary/20 bg-card/90 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HandCoins className="h-5 w-5" />
            </span>
            {t("member_portal.giving_account.my_giving")}
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-11 rounded-2xl">
              <AppLink to="/portal/give">
                <HandCoins className="mr-2 h-4 w-4" />
                {t("member_portal.giving_account.give_now")}
              </AppLink>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <AppLink to="/portal/contribution-history">
                <History className="mr-2 h-4 w-4" />
                {t("member_portal.giving_account.view_contribution_history")}
              </AppLink>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {home.lastPayment ? (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{t("member_portal.giving_account.give_again")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("member_portal.giving_account.repeat_previous_gift", {
                    purpose: home.lastPayment.purpose,
                    amount: formatTZSForLanguage(home.lastPayment.amount, language),
                  })}
                </p>
              </div>
              <Button asChild variant="secondary" className="h-10 shrink-0 rounded-xl">
                <AppLink
                  to={`/portal/give?purpose=${encodeURIComponent(home.lastPayment.purpose)}&amount=${encodeURIComponent(String(home.lastPayment.amount))}`}
                >
                  {t("member_portal.giving_account.give_again")}
                </AppLink>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">{t("member_portal.giving_account.first_contribution_title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("member_portal.giving_account.first_contribution_description")}
            </p>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr]">
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("member_portal.giving_account.total_this_month")}</p>
            <p className="mt-2 break-words text-xl font-bold text-foreground">{formatTZSForLanguage(home.totalThisMonth, language)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("member_portal.giving_account.lifetime_giving")}</p>
            <p className="mt-2 break-words text-xl font-bold text-foreground">{formatTZSForLanguage(home.totalPaid, language)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("member_portal.giving_account.last_contribution")}</p>
            {home.lastPayment ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.amount")}</p>
                  <p className="break-words text-xl font-bold text-foreground">{formatTZSForLanguage(home.lastPayment.amount, language)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.purpose")}</p>
                  <p className="break-words text-sm font-semibold text-foreground">{home.lastPayment.purpose}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.date")}</p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(home.lastPayment.date, language)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("member_portal.giving_account.status")}</p>
                  <p className="text-sm font-semibold text-foreground">{home.lastPayment.status}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("member_portal.giving_account.no_contribution_recorded")}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
