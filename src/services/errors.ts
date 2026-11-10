/** The user is not signed in, or the saved login no longer works. */
export class AuthError extends Error {
  override name = 'AuthError';
}

/** YouTube answered, but not in a shape this app understands: its private API changed. Not the user's fault, and retrying will not help. */
export class FormatError extends Error {
  override name = 'FormatError';
  constructor(what: string) {
    super(`YouTube Music answered in a format this version cannot read (${what}). Your saved playlists are untouched. YouTube probably changed its private API: check for an app update, or report it on GitHub.`);
  }
}

/** Turn whatever a failed request threw into an AuthError when it means "signed out". */
export function asAuthError(e: unknown): unknown {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(401|403)\b|unauthori[sz]ed|not (signed|logged) in|sign in|login required/iu.test(msg) ? new AuthError(msg) : e;
}

export const messageOf = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));
