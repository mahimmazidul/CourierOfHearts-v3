// API layer. Production and dev both call relative /api/v1 URLs — no
// hardcoded hosts or ports in browser code (nginx/vite proxy handle routing).
// The GitHub Pages preview build (VITE_DEMO_MODE=true) swaps in a browser-only
// demo store with zero access to any production API.
import type {
  Letter,
  CreateLetterPayload,
  UpdateLetterPayload,
  LetterResponse,
  LettersListResponse,
} from '@/types/letter';
import { demoApi, isDemoMode } from '@/services/demoApi';

const API_BASE_URL = '/api/v1';
const TOKEN_STORAGE_KEY = 'courier_of_hearts_management_tokens';

type TokenStore = Record<string, string>;
type ApiLetterResponse = LetterResponse & { token?: string };

function getTokenStore(): TokenStore {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TokenStore) : {};
  } catch {
    return {};
  }
}

function saveTokenStore(tokens: TokenStore): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage full or unavailable — management links degrade gracefully.
  }
}

function rememberToken(slug: string, token?: string): void {
  if (!token) return;
  const tokens = getTokenStore();
  tokens[slug] = token;
  saveTokenStore(tokens);
}

function forgetToken(slug: string): void {
  const tokens = getTokenStore();
  delete tokens[slug];
  saveTokenStore(tokens);
}

function getToken(slug: string): string | undefined {
  return getTokenStore()[slug];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const body = await response.json().catch(() => ({ success: false, error: 'Invalid server response' }));
    return body as T;
  } catch {
    return { success: false, error: 'The courier could not reach the archive. Check your connection.' } as T;
  }
}

export async function createLetter(payload: CreateLetterPayload): Promise<LetterResponse> {
  if (isDemoMode) return demoApi.createLetter(payload);
  const result = await request<ApiLetterResponse>('/letters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.success && result.data) rememberToken(result.data.slug, result.token);
  return { success: result.success, data: result.data, error: result.error };
}

export async function getLetter(slug: string): Promise<LetterResponse> {
  if (isDemoMode) return demoApi.getLetter(slug);
  return request<LetterResponse>(`/letters/${encodeURIComponent(slug)}`);
}

export async function updateLetter(slug: string, payload: UpdateLetterPayload): Promise<LetterResponse> {
  if (isDemoMode) return { success: false, error: 'Editing is disabled in the demo preview.' };
  const token = getToken(slug);
  return request<LetterResponse>(`/letters/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  });
}

export async function deleteLetter(slug: string): Promise<LetterResponse> {
  if (isDemoMode) return demoApi.deleteLetter(slug);
  const token = getToken(slug);
  const result = await request<LetterResponse>(`/letters/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (result.success) forgetToken(slug);
  return result;
}

export async function listLetters(): Promise<LettersListResponse> {
  if (isDemoMode) return demoApi.listLetters();
  const slugs = Object.keys(getTokenStore());
  if (slugs.length === 0) return { success: true, data: [] };
  const result = await request<LettersListResponse>(`/letters?slugs=${encodeURIComponent(slugs.join(','))}`);
  if (result.success && result.data) {
    const liveSlugs = new Set(result.data.map((letter: Letter) => letter.slug));
    const tokens = getTokenStore();
    let changed = false;
    for (const slug of Object.keys(tokens)) {
      if (!liveSlugs.has(slug)) {
        delete tokens[slug];
        changed = true;
      }
    }
    if (changed) saveTokenStore(tokens);
  }
  return result;
}

export async function unlockLetter(slug: string, password: string): Promise<LetterResponse> {
  if (isDemoMode) return demoApi.unlockLetter(slug, password);
  return request<LetterResponse>(`/letters/${encodeURIComponent(slug)}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function recoverLetter(slug: string, recoveryToken: string): Promise<LetterResponse> {
  if (isDemoMode) return { success: false, error: 'Recovery is disabled in the demo preview.' };
  return request<LetterResponse>(`/letters/${encodeURIComponent(slug)}/recover`, {
    method: 'POST',
    body: JSON.stringify({ recoveryToken }),
  });
}

export async function recordLetterView(slug: string): Promise<{ success: boolean; views?: number }> {
  if (isDemoMode) return { success: true };
  return request<{ success: boolean; views?: number }>(`/letters/${encodeURIComponent(slug)}/view`, {
    method: 'POST',
  });
}
