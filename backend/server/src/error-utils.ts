// Narrows a caught `unknown` error to an Axios-shaped error with a numeric
// HTTP status, without depending on axios's own type guard (which requires
// the error to be an actual AxiosError instance).
export function isAxiosErrorWithStatus(error: unknown): error is { response: { status: number } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: { status?: unknown } }).response !== null &&
    typeof (error as { response: { status?: unknown } }).response.status === 'number'
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
