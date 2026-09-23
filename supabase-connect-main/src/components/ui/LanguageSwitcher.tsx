import { Button } from "@/components/ui/button";
import { changeAppLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type LanguageSwitcherProps = {
  className?: string;
  buttonClassName?: string;
};

export function LanguageSwitcher({ className, buttonClassName }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label={t("language_switcher.label")}>
      <Button
        type="button"
        variant={i18n.language === "en" ? "secondary" : "ghost"}
        size="sm"
        className={cn("h-8 rounded-xl px-2.5 text-[11px] font-semibold", buttonClassName)}
        aria-label={t("language_switcher.switch_to_english")}
        aria-pressed={i18n.language === "en"}
        onClick={() => changeAppLanguage("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={i18n.language === "sw" ? "secondary" : "ghost"}
        size="sm"
        className={cn("h-8 rounded-xl px-2.5 text-[11px] font-semibold", buttonClassName)}
        aria-label={t("language_switcher.switch_to_swahili")}
        aria-pressed={i18n.language === "sw"}
        onClick={() => changeAppLanguage("sw")}
      >
        SW
      </Button>
    </div>
  );
}
