export type AnalyticsAssistantPresenceState = "idle" | "thinking" | "success";

const STORAGE_KEY = "analytics-assistant-presence";
const EVENT_NAME = "analytics-assistant-presence-change";

function isPresenceState(value: string | null): value is AnalyticsAssistantPresenceState {
  return value === "idle" || value === "thinking" || value === "success";
}

export function getAnalyticsAssistantPresence(): AnalyticsAssistantPresenceState {
  if (typeof window === "undefined") return "idle";

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  return isPresenceState(storedValue) ? storedValue : "idle";
}

export function setAnalyticsAssistantPresence(state: AnalyticsAssistantPresenceState) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, state);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
}

export function subscribeToAnalyticsAssistantPresence(
  callback: (state: AnalyticsAssistantPresenceState) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handlePresenceChange = (event: Event) => {
    const customEvent = event as CustomEvent<AnalyticsAssistantPresenceState>;
    if (isPresenceState(customEvent.detail)) {
      callback(customEvent.detail);
      return;
    }

    callback(getAnalyticsAssistantPresence());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    callback(getAnalyticsAssistantPresence());
  };

  window.addEventListener(EVENT_NAME, handlePresenceChange as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, handlePresenceChange as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
}
