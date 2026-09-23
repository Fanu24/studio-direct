import {
  persistCompleteness,
  type CompletenessDatabase,
} from "./completeness";

export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_CONTENT_TYPE = "application/pdf";

export type CvUploadFile = {
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
} | null;

export type CvBucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
};

export type CvUploadResult =
  | { status: 400; code: "invalid_type" | "too_large" }
  | { status: 200; key: string; completeness: number };

export function cvObjectKey(userId: string, objectId: string): string {
  return `cv/${userId}/${objectId}.pdf`;
}

function pdfContentType(type: string): boolean {
  return type.trim().split(";")[0]?.trim().toLowerCase() === CV_CONTENT_TYPE;
}

export function cvUploadRejection(
  file: CvUploadFile,
): { status: 400; code: "invalid_type" | "too_large" } | null {
  if (!file || !pdfContentType(file.type)) {
    return { status: 400, code: "invalid_type" };
  }
  if (file.size > MAX_CV_BYTES) {
    return { status: 400, code: "too_large" };
  }
  return null;
}

export async function uploadCv(input: {
  userId: string;
  file: CvUploadFile;
  bucket: CvBucket;
  db: CompletenessDatabase;
}): Promise<CvUploadResult> {
  const file = input.file;
  const rejected = cvUploadRejection(file);
  if (rejected || !file) {
    return rejected ?? { status: 400, code: "invalid_type" };
  }

  const body = await file.arrayBuffer();
  if (body.byteLength > MAX_CV_BYTES) {
    return { status: 400, code: "too_large" };
  }

  if(!body.byteLength||new TextDecoder().decode(body.slice(0,5))!=='%PDF-')return {status:400,code:'invalid_type'};
  const key = cvObjectKey(input.userId, crypto.randomUUID());
  await input.bucket.put(key, body, {
    httpMetadata: { contentType: CV_CONTENT_TYPE },
  });

  await input.db
    .prepare(
      `INSERT INTO profiles (
         user_id, cv_r2_key, completeness, talent_pool_opt_in
       ) VALUES (?, ?, 0, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         cv_r2_key = excluded.cv_r2_key`,
    )
    .bind(input.userId, key)
    .run?.();

  const completeness = await persistCompleteness(input.db, input.userId);
  return { status: 200, key, completeness };
}
