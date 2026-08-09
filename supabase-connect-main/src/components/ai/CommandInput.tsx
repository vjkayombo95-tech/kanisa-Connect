import { forwardRef } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type CommandInputProps = {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  ariaLabel: string;
};

export const CommandInput = forwardRef<HTMLInputElement, CommandInputProps>(
  ({ value, onChange, onKeyDown, placeholder, ariaLabel }, ref) => {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 rounded-lg border-border bg-background pl-10 pr-4 text-base"
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    );
  },
);

CommandInput.displayName = "CommandInput";
