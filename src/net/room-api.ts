/** HTTP is used only to create, claim and delete pairing rooms. */
export async function roomApi<T>(path: string, token: string | null, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {'content-type': 'application/json'};
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`/api/rooms${path}`, {
    method, headers, cache: 'no-store', credentials: 'same-origin',
    signal: AbortSignal.timeout(8000), ...(body ? {body: JSON.stringify(body)} : {}),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Sign in to this browser and open the controller link again.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not pair.');
  return data as T;
}
