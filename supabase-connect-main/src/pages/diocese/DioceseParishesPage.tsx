import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";

import { useDioceseWorkspace } from "@/components/diocese/DioceseWorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDioceseParishes,
  type DioceseParish,
} from "@/lib/diocese-workspace";

function parishInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DioceseParishCard({ parish }: { parish: DioceseParish }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex gap-4 p-4 sm:p-5">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage
            src={parish.church_logo_url ?? undefined}
            alt={parish.church_name}
          />
          <AvatarFallback>
            {parishInitials(parish.church_name) || (
              <Building2 className="h-5 w-5" aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div>
            <h2 className="break-words font-semibold">
              {parish.church_name}
            </h2>

            {parish.church_code ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("diocese_workspace.pages.parishes.code")}:{" "}
                {parish.church_code}
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            {parish.church_address ? (
              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="break-words">{parish.church_address}</span>
              </div>
            ) : null}

            {parish.church_phone ? (
              <div className="flex items-start gap-2">
                <Phone
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="break-all">{parish.church_phone}</span>
              </div>
            ) : null}

            {parish.church_email ? (
              <div className="flex items-start gap-2">
                <Mail
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="break-all">{parish.church_email}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DioceseParishesLoading() {
  const { t } = useTranslation();

  return (
    <div
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      aria-label={t("diocese_workspace.pages.parishes.loading")}
    >
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardContent className="flex gap-4 p-4 sm:p-5">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DioceseParishesPage() {
  const { t } = useTranslation();
  const workspace = useDioceseWorkspace();
  const [search, setSearch] = useState("");

  const parishesQuery = useQuery({
    queryKey: ["diocese-parishes", workspace.diocese_id],
    queryFn: () => getDioceseParishes(workspace.diocese_id),
    staleTime: 60_000,
    retry: 1,
  });

  const filteredParishes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();

    if (!term) {
      return parishesQuery.data ?? [];
    }

    return (parishesQuery.data ?? []).filter((parish) =>
      [
        parish.church_name,
        parish.church_code,
        parish.church_address,
        parish.church_email,
        parish.church_phone,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(term)),
    );
  }, [parishesQuery.data, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("diocese_workspace.pages.parishes.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("diocese_workspace.pages.parishes.description")}
        </p>
      </div>

      {parishesQuery.isLoading ? (
        <DioceseParishesLoading />
      ) : parishesQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {t("diocese_workspace.pages.parishes.error.title")}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p>
              {t("diocese_workspace.pages.parishes.error.description")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void parishesQuery.refetch()}
              disabled={parishesQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  parishesQuery.isFetching ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              {t("diocese_workspace.pages.parishes.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (parishesQuery.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2
              className="mx-auto h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="mt-4 font-semibold">
              {t("diocese_workspace.pages.parishes.empty.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t("diocese_workspace.pages.parishes.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("diocese_workspace.pages.parishes.count", {
                count: parishesQuery.data?.length ?? 0,
              })}
            </p>

            <div className="relative w-full sm:max-w-sm">
              <label htmlFor="diocese-parish-search" className="sr-only">
                {t("diocese_workspace.pages.parishes.search_label")}
              </label>
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="diocese-parish-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t(
                  "diocese_workspace.pages.parishes.search_placeholder",
                )}
                className="pl-9"
              />
            </div>
          </div>

          {filteredParishes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Search
                  className="mx-auto h-9 w-9 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-3 font-medium">
                  {t("diocese_workspace.pages.parishes.no_results")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredParishes.map((parish) => (
                <DioceseParishCard
                  key={parish.diocese_church_id}
                  parish={parish}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
