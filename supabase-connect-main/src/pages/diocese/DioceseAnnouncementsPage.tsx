import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Edit,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

import { useDioceseWorkspace } from "@/components/diocese/DioceseWorkspaceContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  archiveDioceseAnnouncement,
  getDioceseAnnouncements,
  publishDioceseAnnouncement,
  saveDioceseAnnouncement,
  type DioceseAnnouncement,
  type DioceseAnnouncementTargetMode,
} from "@/lib/diocese-announcements";
import {
  getDioceseParishes,
  type DioceseParish,
} from "@/lib/diocese-workspace";

type ComposerState = {
  id: string | null;
  title: string;
  content: string;
  targetMode: DioceseAnnouncementTargetMode;
  targetChurchIds: string[];
};

const emptyComposer: ComposerState = {
  id: null,
  title: "",
  content: "",
  targetMode: "all_parishes",
  targetChurchIds: [],
};

function statusVariant(status: DioceseAnnouncement["status"]) {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

function audienceSummary(
  announcement: DioceseAnnouncement,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (announcement.target_mode === "all_parishes") {
    return t("diocese_workspace.pages.announcements.audience.all_parishes");
  }

  return t("diocese_workspace.pages.announcements.audience.selected_count", {
    count: announcement.target_count,
  });
}

function DioceseAnnouncementsLoading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ParishPicker({
  parishes,
  selectedIds,
  onChange,
}: {
  parishes: DioceseParish[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const selected = new Set(selectedIds);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t("diocese_workspace.pages.announcements.form.select_parishes")}
      </p>
      <div className="max-h-56 space-y-2 overflow-auto rounded-md border border-border p-3">
        {parishes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("diocese_workspace.pages.announcements.form.no_parishes")}
          </p>
        ) : (
          parishes.map((parish) => {
            const checked = selected.has(parish.church_id);

            return (
              <label
                key={parish.diocese_church_id}
                className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    if (value) {
                      onChange([...selectedIds, parish.church_id]);
                    } else {
                      onChange(
                        selectedIds.filter((id) => id !== parish.church_id),
                      );
                    }
                  }}
                />
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">
                    {parish.church_name}
                  </span>
                  {parish.church_code ? (
                    <span className="block text-xs text-muted-foreground">
                      {parish.church_code}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DioceseAnnouncementsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const workspace = useDioceseWorkspace();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(emptyComposer);

  const announcementsQuery = useQuery({
    queryKey: ["diocese-announcements", workspace.diocese_id],
    queryFn: () => getDioceseAnnouncements(workspace.diocese_id),
    staleTime: 30_000,
    retry: 1,
  });

  const parishesQuery = useQuery({
    queryKey: ["diocese-parishes", workspace.diocese_id],
    queryFn: () => getDioceseParishes(workspace.diocese_id),
    staleTime: 60_000,
    retry: 1,
  });

  const invalidateAnnouncements = () =>
    queryClient.invalidateQueries({
      queryKey: ["diocese-announcements", workspace.diocese_id],
    });

  const saveMutation = useMutation({
    mutationFn: (status: "draft" | "published") =>
      saveDioceseAnnouncement({
        dioceseId: workspace.diocese_id,
        announcementId: composer.id,
        title: composer.title,
        content: composer.content,
        status,
        targetMode: composer.targetMode,
        targetChurchIds:
          composer.targetMode === "selected_parishes"
            ? composer.targetChurchIds
            : [],
      }),
    onSuccess: async (_result, status) => {
      await invalidateAnnouncements();
      setComposerOpen(false);
      setComposer(emptyComposer);
      toast({
        title: t(
          status === "published"
            ? "diocese_workspace.pages.announcements.toast.published"
            : "diocese_workspace.pages.announcements.toast.saved",
        ),
      });
    },
    onError: () => {
      toast({
        title: t("diocese_workspace.pages.announcements.toast.save_error"),
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (announcementId: string) =>
      publishDioceseAnnouncement(workspace.diocese_id, announcementId),
    onSuccess: async () => {
      await invalidateAnnouncements();
      toast({
        title: t("diocese_workspace.pages.announcements.toast.published"),
      });
    },
    onError: () => {
      toast({
        title: t("diocese_workspace.pages.announcements.toast.publish_error"),
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (announcementId: string) =>
      archiveDioceseAnnouncement(workspace.diocese_id, announcementId),
    onSuccess: async () => {
      await invalidateAnnouncements();
      toast({
        title: t("diocese_workspace.pages.announcements.toast.archived"),
      });
    },
    onError: () => {
      toast({
        title: t("diocese_workspace.pages.announcements.toast.archive_error"),
        variant: "destructive",
      });
    },
  });

  const canSave = useMemo(() => {
    if (!composer.title.trim() || !composer.content.trim()) {
      return false;
    }

    if (composer.targetMode === "selected_parishes") {
      return composer.targetChurchIds.length > 0;
    }

    return true;
  }, [composer]);

  useEffect(() => {
    if (!composerOpen) {
      setComposer(emptyComposer);
    }
  }, [composerOpen]);

  const openNewComposer = () => {
    setComposer(emptyComposer);
    setComposerOpen(true);
  };

  const openEditComposer = (announcement: DioceseAnnouncement) => {
    setComposer({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      targetMode: announcement.target_mode,
      targetChurchIds: announcement.parish_targets.map(
        (target) => target.church_id,
      ),
    });
    setComposerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("diocese_workspace.pages.announcements.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("diocese_workspace.pages.announcements.description")}
          </p>
        </div>

        <Button type="button" onClick={openNewComposer}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("diocese_workspace.pages.announcements.new")}
        </Button>
      </div>

      {announcementsQuery.isLoading ? (
        <DioceseAnnouncementsLoading />
      ) : announcementsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>
            {t("diocese_workspace.pages.announcements.error.title")}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p>
              {t("diocese_workspace.pages.announcements.error.description")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void announcementsQuery.refetch()}
              disabled={announcementsQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  announcementsQuery.isFetching ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              {t("diocese_workspace.pages.announcements.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (announcementsQuery.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone
              className="mx-auto h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="mt-4 font-semibold">
              {t("diocese_workspace.pages.announcements.empty.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {t("diocese_workspace.pages.announcements.empty.description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcementsQuery.data?.map((announcement) => (
            <Card key={announcement.id}>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words font-semibold">
                        {announcement.title}
                      </h2>
                      <Badge variant={statusVariant(announcement.status)}>
                        {t(
                          `diocese_workspace.pages.announcements.status.${announcement.status}`,
                        )}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {announcement.content}
                    </p>
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      {audienceSummary(announcement, t)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {announcement.status !== "archived" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditComposer(announcement)}
                      >
                        <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t(
                          "diocese_workspace.pages.announcements.actions.edit",
                        )}
                      </Button>
                    ) : null}
                    {announcement.status === "draft" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          publishMutation.mutate(announcement.id)
                        }
                        disabled={publishMutation.isPending}
                      >
                        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t(
                          "diocese_workspace.pages.announcements.actions.publish",
                        )}
                      </Button>
                    ) : null}
                    {announcement.status !== "archived" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => archiveMutation.mutate(announcement.id)}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        {t(
                          "diocese_workspace.pages.announcements.actions.archive",
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {composer.id
                ? t("diocese_workspace.pages.announcements.form.edit_title")
                : t("diocese_workspace.pages.announcements.form.new_title")}
            </DialogTitle>
            <DialogDescription>
              {t("diocese_workspace.pages.announcements.form.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="diocese-announcement-title">
                {t("diocese_workspace.pages.announcements.form.title")}
              </Label>
              <Input
                id="diocese-announcement-title"
                value={composer.title}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diocese-announcement-content">
                {t("diocese_workspace.pages.announcements.form.content")}
              </Label>
              <Textarea
                id="diocese-announcement-content"
                rows={6}
                value={composer.content}
                onChange={(event) =>
                  setComposer((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <Label>
                {t("diocese_workspace.pages.announcements.form.audience")}
              </Label>
              <RadioGroup
                value={composer.targetMode}
                onValueChange={(value) =>
                  setComposer((current) => ({
                    ...current,
                    targetMode: value as DioceseAnnouncementTargetMode,
                    targetChurchIds:
                      value === "all_parishes"
                        ? []
                        : current.targetChurchIds,
                  }))
                }
              >
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem value="all_parishes" />
                  <span className="text-sm font-medium">
                    {t(
                      "diocese_workspace.pages.announcements.audience.all_parishes",
                    )}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem value="selected_parishes" />
                  <span className="text-sm font-medium">
                    {t(
                      "diocese_workspace.pages.announcements.audience.selected_parishes",
                    )}
                  </span>
                </label>
              </RadioGroup>
            </div>

            {composer.targetMode === "selected_parishes" ? (
              parishesQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : parishesQuery.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>
                    {t(
                      "diocese_workspace.pages.announcements.form.parish_error_title",
                    )}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void parishesQuery.refetch()}
                    >
                      <RefreshCw
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      {t("diocese_workspace.pages.announcements.retry")}
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <ParishPicker
                  parishes={parishesQuery.data ?? []}
                  selectedIds={composer.targetChurchIds}
                  onChange={(ids) =>
                    setComposer((current) => ({
                      ...current,
                      targetChurchIds: ids,
                    }))
                  }
                />
              )
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveMutation.mutate("draft")}
              disabled={!canSave || saveMutation.isPending}
            >
              {t("diocese_workspace.pages.announcements.actions.save_draft")}
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate("published")}
              disabled={!canSave || saveMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("diocese_workspace.pages.announcements.actions.publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
