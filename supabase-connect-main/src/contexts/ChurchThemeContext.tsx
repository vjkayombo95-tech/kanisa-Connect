import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Preset theme definitions: hex -> HSL values for primary, accent, ring, sidebar-primary, chart-1
export interface ThemePreset {
  name: string;
  hex: string;
  hsl: string;        // primary HSL (h s% l%)
  accentHsl: string;  // accent variation
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Gold / Amber",   hex: "#d4a017", hsl: "40 82% 46%",  accentHsl: "35 85% 42%" },
  { name: "Royal Blue",     hex: "#2563eb", hsl: "217 91% 53%", accentHsl: "220 85% 48%" },
  { name: "Emerald Green",  hex: "#059669", hsl: "160 84% 31%", accentHsl: "155 75% 28%" },
  { name: "Deep Purple",    hex: "#7c3aed", hsl: "263 84% 58%", accentHsl: "270 78% 52%" },
  { name: "Crimson Red",    hex: "#dc2626", hsl: "0 72% 51%",   accentHsl: "5 68% 46%" },
  { name: "Teal",           hex: "#0d9488", hsl: "175 84% 32%", accentHsl: "180 75% 28%" },
  { name: "Rose",           hex: "#e11d48", hsl: "347 77% 50%", accentHsl: "350 72% 45%" },
  { name: "Slate / Gray",   hex: "#64748b", hsl: "215 16% 47%", accentHsl: "220 14% 42%" },
];

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Check contrast ratio for accessibility (WCAG AA: ≥4.5:1 for text)
function getRelativeLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;
  const [r, g, b] = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    .map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function checkContrastOnDark(hex: string): { ratio: number; passes: boolean } {
  const bgLum = getRelativeLuminance("#0d0f14"); // our dark bg
  const fgLum = getRelativeLuminance(hex);
  const lighter = Math.max(bgLum, fgLum);
  const darker = Math.min(bgLum, fgLum);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return { ratio, passes: ratio >= 3 }; // AA for large text / UI elements
}

interface ChurchThemeContextType {
  themeColor: string; // hex
  themeHsl: string;   // HSL string for CSS
  activePreset: ThemePreset | null;
  isLoading: boolean;
}

const ChurchThemeContext = createContext<ChurchThemeContextType>({
  themeColor: "#d4a017",
  themeHsl: "40 82% 46%",
  activePreset: THEME_PRESETS[0],
  isLoading: true,
});

export const useChurchTheme = () => useContext(ChurchThemeContext);

export function ChurchThemeProvider({ children }: { children: ReactNode }) {
  const { churchId, isLoading: authLoading } = useAuth();

  const { data: church, isLoading: churchLoading } = useQuery({
    queryKey: ["church-theme", churchId],
    queryFn: async () => {
      if (!churchId) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("*")
        .eq("id", churchId)
        .maybeSingle();

      if (error) {
        console.warn("Church theme lookup failed, using default theme.", error);
        return null;
      }

      return data as { theme_color?: string | null } | null;
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const themeColor = church?.theme_color || "#d4a017";

  const { themeHsl, activePreset } = useMemo(() => {
    const preset = THEME_PRESETS.find(p => p.hex.toLowerCase() === themeColor.toLowerCase());
    if (preset) {
      return { themeHsl: preset.hsl, activePreset: preset };
    }
    const computed = hexToHsl(themeColor);
    return { themeHsl: computed || "40 82% 46%", activePreset: null };
  }, [themeColor]);

  // Apply CSS custom properties globally
  useEffect(() => {
    const root = document.documentElement;
    const preset = THEME_PRESETS.find(p => p.hex.toLowerCase() === themeColor.toLowerCase());
    const accentHsl = preset?.accentHsl || themeHsl;

    root.style.setProperty("--primary", themeHsl);
    root.style.setProperty("--ring", themeHsl);
    root.style.setProperty("--accent", accentHsl);
    root.style.setProperty("--sidebar-primary", themeHsl);
    root.style.setProperty("--sidebar-ring", themeHsl);
    root.style.setProperty("--chart-1", themeHsl);
    root.style.setProperty("--warning", themeHsl);

    return () => {
      // Reset to defaults on unmount
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--warning");
    };
  }, [themeHsl, themeColor]);

  return (
    <ChurchThemeContext.Provider value={{
      themeColor,
      themeHsl,
      activePreset,
      isLoading: authLoading || churchLoading,
    }}>
      {children}
    </ChurchThemeContext.Provider>
  );
}
