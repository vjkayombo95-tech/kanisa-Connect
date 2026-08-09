export const MEMBER_PREVIEW_STORAGE_KEY = "kanisa.memberPreview.active";
export const MEMBER_PREVIEW_EVENT = "kanisa-member-preview-changed";

export function isMemberPreviewActive() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MEMBER_PREVIEW_STORAGE_KEY) === "true";
}

export function startMemberPreview() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEMBER_PREVIEW_STORAGE_KEY, "true");
  window.dispatchEvent(new Event(MEMBER_PREVIEW_EVENT));
}

export function stopMemberPreview() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MEMBER_PREVIEW_STORAGE_KEY);
  window.dispatchEvent(new Event(MEMBER_PREVIEW_EVENT));
}

export function subscribeMemberPreview(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === MEMBER_PREVIEW_STORAGE_KEY) listener();
  };

  window.addEventListener(MEMBER_PREVIEW_EVENT, listener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(MEMBER_PREVIEW_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
