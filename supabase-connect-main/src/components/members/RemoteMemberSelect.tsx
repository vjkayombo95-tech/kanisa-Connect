import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export type RemoteMemberOption = {
  id: string;
  full_name: string;
  phone?: string | null;
  community_id?: string | null;
};

type RemoteMemberSelectProps = {
  churchId?: string | null;
  value: string;
  selectedMember?: RemoteMemberOption | null;
  onValueChange: (member: RemoteMemberOption | null) => void;
  communityId?: string | null;
  placeholder?: string;
  disabled?: boolean;
};

export function RemoteMemberSelect({
  churchId,
  value,
  selectedMember,
  onValueChange,
  communityId,
  placeholder = "Search member by name or phone",
  disabled = false,
}: RemoteMemberSelectProps) {
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  useEffect(() => {
    if (!value) {
      setSearch("");
    }
  }, [value]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["remote-member-select", churchId, communityId, trimmedSearch],
    queryFn: async () => {
      if (!churchId || trimmedSearch.length < 2) return [];
      const safeSearch = trimmedSearch.replace(/[,()]/g, " ");
      let query = supabase
        .from("members")
        .select("id, full_name, phone, community_id")
        .eq("church_id", churchId)
        .eq("status", "active")
        .or(`full_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`)
        .order("full_name");

      if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;
      return (data ?? []) as RemoteMemberOption[];
    },
    enabled: !!churchId && trimmedSearch.length >= 2 && !disabled,
  });

  const helperText = useMemo(() => {
    if (selectedMember) return selectedMember.phone ? selectedMember.phone : "Selected member";
    if (trimmedSearch.length === 0) return "Type at least 2 characters.";
    if (trimmedSearch.length < 2) return "Keep typing to search.";
    if (isFetching) return "Searching...";
    if (results.length === 0) return "No matching members.";
    return "Select one of the matching members.";
  }, [isFetching, results.length, selectedMember, trimmedSearch.length]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={selectedMember ? selectedMember.full_name : search}
          onChange={(event) => {
            onValueChange(null);
            setSearch(event.target.value);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">{helperText}</p>
      {!selectedMember && results.length > 0 ? (
        <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-popover p-1">
          {results.map((member) => (
            <Button
              key={member.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start px-2 py-2 text-left"
              onClick={() => onValueChange(member)}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{member.full_name}</span>
                {member.phone ? <span className="truncate text-xs text-muted-foreground">{member.phone}</span> : null}
              </span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
