import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, FileClock, Loader2, Search, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  id: string;
  label: string;
  description: string;
  path: string;
};

type GroupedResults = {
  churches: SearchResult[];
  users: SearchResult[];
  jobs: SearchResult[];
  audits: SearchResult[];
  alerts: SearchResult[];
};

const emptyResults: GroupedResults = {
  churches: [],
  users: [],
  jobs: [],
  audits: [],
  alerts: [],
};

function normalizeGroupedResults(value: unknown): GroupedResults {
  const results = value as Partial<GroupedResults> | null;

  return {
    churches: Array.isArray(results?.churches) ? results.churches : [],
    users: Array.isArray(results?.users) ? results.users : [],
    jobs: Array.isArray(results?.jobs) ? results.jobs : [],
    audits: Array.isArray(results?.audits) ? results.audits : [],
    alerts: Array.isArray(results?.alerts) ? results.alerts : [],
  };
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function SuperAdminSearch({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const { data = emptyResults, isFetching } = useQuery({
    queryKey: ["super-admin-global-search", debouncedQuery],
    enabled: debouncedQuery.length >= 3,
    queryFn: async (): Promise<GroupedResults> => {
      const { data, error } = await supabase.rpc("global_search" as never, {
        search_text: debouncedQuery,
      } as never);

      if (error) throw error;

      return normalizeGroupedResults(data);
    },
  });

  const totalResults = useMemo(
    () => Object.values(data).reduce((total, group) => total + group.length, 0),
    [data],
  );

  const goToResult = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    setQuery("");
  };

  const renderGroup = (title: string, icon: typeof Building2, results: SearchResult[]) => {
    if (results.length === 0) return null;
    const Icon = icon;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        {results.map((result) => (
          <button
            key={`${title}-${result.id}`}
            type="button"
            onClick={() => goToResult(result)}
            className="w-full rounded-lg px-2 py-2 text-left hover:bg-secondary"
          >
            <div className="truncate text-sm font-medium">{result.label}</div>
            <div className="truncate text-xs text-muted-foreground">{result.description}</div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search platform..."
        className="h-9 border-border/50 bg-secondary pl-9"
      />
      {open && query.trim().length > 0 ? (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[28rem] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl">
          {query.trim().length < 3 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type at least 3 characters</p>
          ) : isFetching ? (
            <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : totalResults === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Badge variant="outline">{totalResults} result{totalResults === 1 ? "" : "s"}</Badge>
              </div>
              {renderGroup("Churches", Building2, data.churches)}
              {renderGroup("Users", UserRound, data.users)}
              {renderGroup("Jobs", ClipboardList, data.jobs)}
              {renderGroup("Audit Logs", FileClock, data.audits)}
              {renderGroup("Alerts", ShieldAlert, data.alerts)}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
