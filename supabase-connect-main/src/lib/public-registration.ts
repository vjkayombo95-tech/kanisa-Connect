import { supabase } from "@/integrations/supabase/client";

const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PublicChurch = {
  id: string;
  name: string;
  code: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PublicDirectoryRow = {
  id: string;
  name: string;
};

const getFileExtension = (file: File) => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
};

export function validateRegistrationPhoto(file: File) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { valid: false, error: "Please upload a JPG, PNG, or WebP image." };
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return { valid: false, error: "Photo must be 2MB or smaller." };
  }

  return { valid: true };
}

export function isPublicRegistrationEnabled(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return true;
  }

  return (metadata as Record<string, unknown>).public_registration_enabled !== false;
}

export async function fetchPublicRegistrationChurch(params: {
  churchCode?: string | null;
  churchId?: string | null;
}) {
  const churchCode = params.churchCode?.trim() || "";
  const churchId = params.churchId?.trim() || "";

  if (!churchCode && !churchId) {
    return null;
  }

  const rpcResult = await supabase.rpc("get_public_registration_church" as never, {
    _church_code: churchCode || null,
    _church_id: churchId || null,
  } as never);

  if (!rpcResult.error) {
    return ((rpcResult.data as PublicChurch[] | null)?.[0] ?? null) as PublicChurch | null;
  }

  console.warn("Falling back to direct church lookup:", rpcResult.error.message);

  const byIdQuery = churchId
    ? supabase.from("churches").select("id, name, code").eq("id", churchId).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const byCodeQuery = !churchId && churchCode
    ? supabase.from("churches").select("id, name, code").eq("code", churchCode).maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const fallbackResult = churchId ? await byIdQuery : await byCodeQuery;
  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  if (!fallbackResult.data) {
    return null;
  }

  return {
    id: fallbackResult.data.id,
    name: fallbackResult.data.name,
    code: fallbackResult.data.code,
    metadata: null,
  } satisfies PublicChurch;
}

export async function fetchPublicRegistrationCommunities(churchId: string) {
  const rpcResult = await supabase.rpc("get_public_registration_communities" as never, {
    _church_id: churchId,
  } as never);

  if (!rpcResult.error) {
    return (rpcResult.data as PublicDirectoryRow[] | null) ?? [];
  }

  console.warn("Falling back to direct communities lookup:", rpcResult.error.message);

  const { data, error } = await supabase
    .from("communities")
    .select("id, name")
    .eq("church_id", churchId)
    .order("name");

  if (error) {
    throw error;
  }

  return (data as PublicDirectoryRow[] | null) ?? [];
}

export async function fetchPublicRegistrationMinistries(churchId: string) {
  const rpcResult = await supabase.rpc("get_public_registration_ministries" as never, {
    _church_id: churchId,
  } as never);

  if (!rpcResult.error) {
    return (rpcResult.data as PublicDirectoryRow[] | null) ?? [];
  }

  console.warn("Falling back to direct ministries lookup:", rpcResult.error.message);

  const { data, error } = await supabase
    .from("ministries")
    .select("id, name")
    .eq("church_id", churchId)
    .order("name");

  if (error) {
    throw error;
  }

  return (data as PublicDirectoryRow[] | null) ?? [];
}

export async function uploadRegistrationPhoto(file: File) {
  const ext = getFileExtension(file);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const storagePath = `members/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);

  return {
    photoUrl: data.publicUrl,
    storagePath,
  };
}

export async function removeRegistrationPhoto(storagePath: string | null) {
  if (!storagePath) return;

  const { error } = await supabase.storage.from("avatars").remove([storagePath]);
  if (error) {
    console.warn("Failed to clean up uploaded avatar:", error.message);
  }
}
