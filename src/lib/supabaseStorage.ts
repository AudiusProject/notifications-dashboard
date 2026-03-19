/** Bucket used for CSV + announcement image uploads (must exist in Supabase project). */
export const UPLOADS_BUCKET = 'uploads'

/**
 * Turn raw Supabase Storage errors into actionable dashboard messages.
 */
export function formatStorageUploadError(
  raw: string | undefined,
  kind: 'image' | 'csv'
): string {
  const msg = raw?.trim() ?? ''
  if (/bucket not found/i.test(msg)) {
    return `Supabase Storage bucket "${UPLOADS_BUCKET}" does not exist. In the Supabase dashboard: Storage → New bucket → set name to ${UPLOADS_BUCKET}. Enable **Public** (or add storage policies so the service role can upload and objects are publicly readable for push image URLs). See README.`
  }
  if (msg.length > 0) {
    return msg
  }
  return kind === 'image'
    ? 'Failed to upload image to storage'
    : 'Failed to upload CSV to storage'
}
