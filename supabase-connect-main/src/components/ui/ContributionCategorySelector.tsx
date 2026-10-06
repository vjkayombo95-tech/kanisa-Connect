import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { translateContributionCategory } from "@/lib/translation-helpers";

type ContributionCategoryOption = {
  id: string;
  name: string;
};

type ContributionCategorySelectorProps = {
  categories: ContributionCategoryOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholderKey?: string;
  translateLabels?: boolean;
};

export function ContributionCategorySelector({
  categories,
  value,
  onValueChange,
  placeholderKey = "contributions.select_category",
  translateLabels = true,
}: ContributionCategorySelectorProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={t(placeholderKey)} />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {translateLabels ? translateContributionCategory(t, category.name, "short") : category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
