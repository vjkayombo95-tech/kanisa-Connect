import type { CommandCenterResult } from "./command-types";
import { CommandResultItem } from "./CommandResultItem";
import { useTranslation } from "react-i18next";

type CommandResultsProps = {
  results: CommandCenterResult[];
  activeIndex: number;
  onExecute: (result: CommandCenterResult) => void;
  onActiveChange: (index: number) => void;
};

export function CommandResults({ results, activeIndex, onExecute, onActiveChange }: CommandResultsProps) {
  const { t } = useTranslation();
  if (!results.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t("command_center.no_match")}
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={t("command_center.title")} className="space-y-1">
      {results.map((result, index) => (
        <CommandResultItem
          key={result.id}
          result={result}
          active={index === activeIndex}
          onExecute={onExecute}
          onHover={() => onActiveChange(index)}
        />
      ))}
    </div>
  );
}
