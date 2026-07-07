import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getAuthorizedCalendarVisibilityOptions,
  getAuthorizedCalendarWorkspaceOptions,
  parishCalendarCategories,
  parishCalendarEventTypes,
  shouldShowCalendarWorkspaceFilter,
  type ParishCalendarServiceOption,
} from "./calendarUtils";
import type { ParishCalendarCategory, ParishCalendarEventType, ParishCalendarFilters, ParishCalendarWorkspace } from "./types";

type CalendarFiltersProps = {
  filters: ParishCalendarFilters;
  workspace: ParishCalendarWorkspace;
  services: ParishCalendarServiceOption[];
  communities: string[];
  churches: Array<{ id: string; name: string }>;
  eventTypes: ParishCalendarEventType[];
  categories: ParishCalendarCategory[];
  onChange: (filters: ParishCalendarFilters) => void;
};

export function CalendarFilters({ filters, workspace, services, communities, churches, eventTypes, categories, onChange }: CalendarFiltersProps) {
  const { t } = useTranslation();
  const categoryValues = new Set(categories);
  const eventTypeValues = new Set(eventTypes);
  const translatedCategories = parishCalendarCategories
    .filter((item) => categoryValues.has(item.value))
    .map((item) => ({ ...item, label: t(item.labelKey, item.label) }));
  const translatedTypes = parishCalendarEventTypes
    .filter((item) => eventTypeValues.has(item.value))
    .map((item) => ({ ...item, label: t(item.labelKey, item.label) }));
  const translatedVisibilities = getAuthorizedCalendarVisibilityOptions(workspace).map((item) => ({ ...item, label: t(item.labelKey, item.label) }));
  const translatedWorkspaces = getAuthorizedCalendarWorkspaceOptions(workspace).map((item) => ({ ...item, label: t(item.labelKey, item.label) }));
  const showWorkspaceFilter = shouldShowCalendarWorkspaceFilter(workspace);

  return (
    <section className="grid gap-3 rounded-[28px] border border-border/70 bg-card/85 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor="calendar-search">{t("member_portal.parish_life.search")}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="calendar-search"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            className="pl-9"
            placeholder={t("member_portal.parish_life.search_events")}
          />
        </div>
      </div>
      <FilterSelect
        label={t("member_portal.parish_life.category")}
        value={filters.category}
        onValueChange={(value) => onChange({ ...filters, category: value as ParishCalendarFilters["category"] })}
        items={[{ value: "all", label: t("member_portal.parish_life.all_categories") }, ...translatedCategories]}
      />
      <FilterSelect
        label={t("member_portal.parish_life.event_type")}
        value={filters.eventType}
        onValueChange={(value) => onChange({ ...filters, eventType: value as ParishCalendarFilters["eventType"] })}
        items={[{ value: "all", label: t("member_portal.parish_life.all_types") }, ...translatedTypes]}
      />
      {services.length > 0 ? (
        <FilterSelect
          label={t("member_portal.parish_life.ministry")}
          value={filters.ministry}
          onValueChange={(value) => onChange({ ...filters, ministry: value })}
          items={[
            { value: "all", label: t("member_portal.parish_life.all_ministries") },
            ...services.map((service) => ({
              value: service.value,
              label: service.labelKey ? t(service.labelKey, service.label) : service.label,
            })),
          ]}
        />
      ) : null}
      {communities.length > 0 ? (
        <FilterSelect
          label={t("member_portal.parish_life.community")}
          value={filters.community}
          onValueChange={(value) => onChange({ ...filters, community: value })}
          items={[{ value: "all", label: t("member_portal.parish_life.all_communities") }, ...communities.map((name) => ({ value: name, label: name }))]}
        />
      ) : null}
      <FilterSelect
        label={t("member_portal.parish_life.visibility_label")}
        value={filters.visibility}
        onValueChange={(value) => onChange({ ...filters, visibility: value as ParishCalendarFilters["visibility"] })}
        items={[{ value: "all", label: t("member_portal.parish_life.all_visibility") }, ...translatedVisibilities]}
      />
      {showWorkspaceFilter ? (
        <FilterSelect
          label={t("member_portal.parish_life.workspace")}
          value={filters.workspace}
          onValueChange={(value) => onChange({ ...filters, workspace: value as ParishCalendarFilters["workspace"] })}
          items={[{ value: "all", label: t("member_portal.parish_life.all_workspaces") }, ...translatedWorkspaces]}
        />
      ) : null}
      {churches.length > 1 ? (
        <FilterSelect
          label={t("member_portal.parish_life.church")}
          value={filters.church}
          onValueChange={(value) => onChange({ ...filters, church: value })}
          items={[{ value: "all", label: t("member_portal.parish_life.all_churches") }, ...churches.map((church) => ({ value: church.id, label: church.name }))]}
        />
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="calendar-date-from">{t("member_portal.parish_life.from")}</Label>
        <Input
          id="calendar-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="calendar-date-to">{t("member_portal.parish_life.to")}</Label>
        <Input
          id="calendar-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
        />
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
