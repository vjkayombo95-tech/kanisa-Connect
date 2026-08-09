import "./i18n";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logEnvironmentStatus } from "./lib/environment";
import { logWarning } from "./lib/error-logger";
import { markStartupEvent } from "./lib/startup-diagnostics";

markStartupEvent("script_loaded");
logEnvironmentStatus();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      logWarning("Service worker registration failed.", {
        function: "serviceWorker.register",
        metadata: { error },
      });
    });
  });
} else if (!import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => {
        logWarning("Service worker cleanup failed.", {
          function: "serviceWorker.unregister",
          metadata: { error },
        });
      });
  });
}

markStartupEvent("react_root_create_started");
createRoot(document.getElementById("root")!).render(<App />);
markStartupEvent("react_root_render_called");
