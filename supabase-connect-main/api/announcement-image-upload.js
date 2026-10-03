import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    const {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME,
    } = process.env;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !R2_ACCOUNT_ID ||
      !R2_ACCESS_KEY_ID ||
      !R2_SECRET_ACCESS_KEY ||
      !R2_BUCKET_NAME
    ) {
      console.error("Announcement image upload server configuration is incomplete.");
      return sendJson(response, 500, {
        error: "Image upload is not configured.",
      });
    }

    const authorization = request.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return sendJson(response, 401, {
        error: "Authentication required.",
      });
    }

    const accessToken = authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return sendJson(response, 401, {
        error: "Authentication required.",
      });
    }

    const churchId =
      typeof request.body?.churchId === "string"
        ? request.body.churchId.trim()
        : "";

    const contentType =
      typeof request.body?.contentType === "string"
        ? request.body.contentType.trim().toLowerCase()
        : "";

    const fileSize = Number(request.body?.fileSize);

    if (!churchId) {
      return sendJson(response, 400, {
        error: "Church is required.",
      });
    }

    const extension = ALLOWED_IMAGE_TYPES.get(contentType);

    if (!extension) {
      return sendJson(response, 400, {
        error: "Only JPG, PNG and WebP images are allowed.",
      });
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_IMAGE_SIZE
    ) {
      return sendJson(response, 400, {
        error: "Image must be 5 MB or smaller.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return sendJson(response, 401, {
        error: "Invalid or expired session.",
      });
    }

    const { data: canManage, error: permissionError } = await supabase.rpc(
      "can_manage_church_roles",
      {
        _user_id: user.id,
        _church_id: churchId,
      },
    );

    if (permissionError) {
      console.error("Announcement image permission check failed:", permissionError);
      return sendJson(response, 500, {
        error: "Unable to verify upload permission.",
      });
    }

    if (canManage !== true) {
      return sendJson(response, 403, {
        error: "You do not have permission to upload images for this church.",
      });
    }

    const imageKey =
      `announcements/${churchId}/${randomUUID()}.${extension}`;

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: imageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, {
      expiresIn: 300,
    });

    return sendJson(response, 200, {
      uploadUrl,
      imageKey,
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Announcement image upload signing failed:", error);

    return sendJson(response, 500, {
      error: "Unable to prepare image upload.",
    });
  }
}
