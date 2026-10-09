/** The user is not signed in, or the saved login no longer works. */
export class AuthError extends Error {
  override name = 'AuthError';
}

/** Turn whatever a failed request threw into an AuthError when it means "signed out". */
export function asAuthError(e: unknown): unknown {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(401|403)\b|unauthori[sz]ed|not (signed|logged) in|sign in|login required/iu.test(msg) ? new AuthError(msg) : e;
}

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));
