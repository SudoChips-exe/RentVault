import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const DOCUMENTS_BUCKET = 'documents';

// The bucket is private (RLS-gated by anon insert/select policies, not
// public), so a signed URL is required to read a file back - a 10-year
// expiry stands in for a permanent link since these URLs get stored as
// long-lived references (idDocumentUrl, documentUrl, ...) that get viewed
// well after upload, e.g. during admin review.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10;

export async function uploadDocument(file: File, path: string): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw uploadError;

  const { data, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (signError) throw signError;

  return data.signedUrl;
}
