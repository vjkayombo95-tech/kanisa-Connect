import { LockKeyhole, ShieldX } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PERMISSION_CLASSIFICATIONS,
  type PermissionConstraint,
} from "@/lib/permission-constraints";
import { cn } from "@/lib/utils";

type PermissionControlProps = {
  checked: boolean;
  constraint: PermissionConstraint;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

export function PermissionControl({
  checked,
  constraint,
  label,
  onCheckedChange,
}: PermissionControlProps) {
  const configurable = constraint.classification === PERMISSION_CLASSIFICATIONS.CONFIGURABLE;
  const restricted = constraint.classification === PERMISSION_CLASSIFICATIONS.RESTRICTED;
  const helpText = restricted
    ? "Only a Platform Administrator can change this permission."
    : constraint.reason;
  const descriptionId = `permission-${constraint.feature_key}-${constraint.action}-${constraint.classification}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            restricted && "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
            constraint.classification === PERMISSION_CLASSIFICATIONS.SYSTEM_PROTECTED
              && "bg-muted text-muted-foreground",
          )}
          tabIndex={configurable ? -1 : 0}
        >
          <Checkbox
            checked={checked}
            disabled={!configurable}
            aria-label={`${label}. ${constraint.classification.replace(/_/g, " ").toLowerCase()}.`}
            aria-describedby={descriptionId}
            onCheckedChange={(value) => onCheckedChange(value === true)}
          />
          {restricted ? (
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          ) : !configurable ? (
            <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          <span id={descriptionId} className="sr-only">{helpText}</span>
        </span>
      </TooltipTrigger>
      {!configurable && <TooltipContent className="max-w-xs">{helpText}</TooltipContent>}
    </Tooltip>
  );
}
