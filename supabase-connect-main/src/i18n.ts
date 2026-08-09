import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

export type AppLanguage = "en" | "sw";

const LANGUAGE_STORAGE_KEY = "ecclesia-language";

const resources = {
  en: { translation: en },
  sw: { translation: sw },
} as const;

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage === "en" || storedLanguage === "sw") {
    return storedLanguage;
  }

  const browserLanguages = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  const detectedLanguage = browserLanguages.find((language) => {
    const normalized = language.toLowerCase();
    return normalized.startsWith("sw") || normalized.endsWith("-tz");
  });

  if (detectedLanguage) {
    return "sw";
  }

  return "en";
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "sw"],
    defaultNS: "translation",
    ns: ["translation"],
    initImmediate: false,
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on("languageChanged", (language) => {
  if (typeof window !== "undefined" && (language === "en" || language === "sw")) {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
});

export const changeAppLanguage = (language: AppLanguage) => i18n.changeLanguage(language);

export default i18n;
