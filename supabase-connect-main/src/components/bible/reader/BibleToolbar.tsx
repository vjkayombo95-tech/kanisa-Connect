import { Minus, Plus, Search, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReaderTheme, ReadingMode } from "./types";

type BibleToolbarProps = {
  fontScale: number;
  theme: ReaderTheme;
  mode: ReadingMode;
  search: string;
  onFontScaleChange: (scale: number) => void;
  onThemeChange: (theme: ReaderTheme) => void;
  onModeChange: (mode: ReadingMode) => void;
  onSearchChange: (search: string) => void;
};

export function BibleToolbar({
  fontScale,
  theme,
  mode,
  search,
  onFontScaleChange,
  onThemeChange,
  onModeChange,
  onSearchChange,
}: BibleToolbarProps) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/95 p-3 shadow-sm" aria-label="Reading toolbar">
      <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr_auto] lg:items-center">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1" aria-label="Font size">
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-md" onClick={() => onFontScaleChange(Math.max(0.9, fontScale - 0.05))} aria-label="Decrease font size">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="w-12 text-center text-sm font-semibold tabular-nums">{Math.round(fontScale * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-md" onClick={() => onFontScaleChange(Math.min(1.35, fontScale + 0.05))} aria-label="Increase font size">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <Select value={theme} onValueChange={(value) => onThemeChange(value as ReaderTheme)}>
          <SelectTrigger className="h-11 rounded-lg lg:w-36" aria-label="Reading theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} className="h-11 rounded-lg pl-9" placeholder="Search this chapter" aria-label="Search this chapter" />
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => onModeChange(value as ReadingMode)} className="flex-1">
            <TabsList className="grid h-11 w-full grid-cols-3 rounded-lg lg:w-72">
              <TabsTrigger value="read" className="rounded-md">Read</TabsTrigger>
              <TabsTrigger value="listen" className="rounded-md">Listen</TabsTrigger>
              <TabsTrigger value="read-listen" className="rounded-md">Read + Listen</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-lg" aria-label="Reader settings">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
