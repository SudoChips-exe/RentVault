import { auth } from './firebase';

// Replaces firebase/functions httpsCallable now that the backend runs as a
// plain Express server on Render instead of Cloud Functions. Mirrors
// httpsCallable's `{ data }` return shape and throws `{ code, message }` on
// failure so the existing parseFirebaseError() helper keeps working as-is.
export async function callApi<T = any>(name: string, data?: unknown): Promise<{ data: T }> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data ?? {}),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw { code: body.code || 'unknown', message: body.message || 'Request failed' };
  }
  return { data: body as T };
}
