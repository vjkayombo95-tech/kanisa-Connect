import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";
import {
  LANGUAGE_STORAGE_KEY,
  resolveInitialAppLanguage,
  setDocumentLanguage,
  type AppLanguage,
} from "@/lib/localization";

export type { AppLanguage } from "@/lib/localization";

const resources = {
  en: { translation: en },
  sw: { translation: sw },
} as const;

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  return resolveInitialAppLanguage({
    storedLanguage: window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    pathname: window.location.pathname,
    browserLanguages: window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language],
  });
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
    setDocumentLanguage(language);
  }
});

setDocumentLanguage(i18n.language === "sw" ? "sw" : "en");

export const changeAppLanguage = (language: AppLanguage) => i18n.changeLanguage(language);

export default i18n;
