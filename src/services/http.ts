/**
 * fetch() for youtubei.js, implemented by the Rust `http_fetch` command. The webview cannot be used directly:
 * it silently strips forbidden request headers (Cookie, Origin, User-Agent), which YouTube needs.
 * Text only (all YouTube API traffic is JSON/text); the Rust side enforces the host allow-list.
 */
import { invoke } from '@tauri-apps/api/core';

interface HttpResponse {
  status: number;
  headers: [string, string][];
  body: string;
}

/** youtubei.js leaves these out in a browser runtime (the browser would add them); here nothing does, and YouTube
 * rejects cookie logins that arrive without an Origin matching the SAPISIDHASH. */
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const NULL_BODY = new Set([101, 103, 204, 205, 304]);

export async function rustFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const isReq = input instanceof Request;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(isReq ? input.headers : undefined);
  new Headers(init?.headers).forEach((v, k) => headers.set(k, v));
  const origin = new URL(url).origin;
  if (!headers.has('origin')) headers.set('Origin', origin);
  if (!headers.has('referer')) headers.set('Referer', `${origin}/`);
  if (!headers.has('user-agent')) headers.set('User-Agent', DESKTOP_UA);
  const raw = init?.body ?? (isReq ? await input.clone().text() : undefined);
  const body = raw == null ? undefined : typeof raw === 'string' ? raw : await new Response(raw).text();
  const res = await invoke<HttpResponse>('http_fetch', { req: { url, method: init?.method ?? (isReq ? input.method : 'GET'), headers: [...headers.entries()], body } });
  return new Response(NULL_BODY.has(res.status) ? null : res.body, { status: res.status, headers: res.headers.filter(([k]) => k.toLowerCase() !== 'set-cookie') });
}
