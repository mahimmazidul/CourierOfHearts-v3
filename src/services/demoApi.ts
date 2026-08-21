// Browser-only demo store for the GitHub Pages preview.
// No network, no production API, no secrets — letters live in this browser's
// localStorage only and the whole flow is clearly labelled as a demo.
import type { CreateLetterPayload, Letter, LetterResponse, LettersListResponse } from '@/types/letter';
import { sanitizeLetterHtml } from '@/utils/sanitizeHtml';

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const STORE_KEY = 'coh_demo_letters';

interface DemoLetter extends Letter {
  demoPassword?: string;
}

// Sandboxed embeds (e.g. the in-chat file viewer) block localStorage
// entirely; the demo then falls back to this in-memory store so the full
// compose → send → ceremony flow still works within the session.
let memoryStore: DemoLetter[] = [];

function load(): DemoLetter[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : memoryStore;
  } catch {
    return memoryStore;
  }
}

function save(letters: DemoLetter[]): void {
  memoryStore = letters.slice(-20);
  try {
    // Cap demo storage; oldest letters fall away instead of filling the quota.
    localStorage.setItem(STORE_KEY, JSON.stringify(letters.slice(-20)));
  } catch {
    // Quota exceeded — drop older demo letters and retry once.
    try { localStorage.setItem(STORE_KEY, JSON.stringify(letters.slice(-5))); } catch { /* memory store still has them */ }
  }
}

function randomSlug(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  let suffix = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `a-little-letter-${suffix}`;
}

function publicView(letter: DemoLetter, unlocked: boolean): Letter {
  const { demoPassword: _hidden, ...rest } = letter;
  if (letter.isPrivate && !unlocked) {
    return {
      ...rest,
      salutation: '', recipient: '', content: '', closing: '', signature: '',
      flowers: [], requiresPassword: true,
    };
  }
  return { ...rest, requiresPassword: false };
}

export const demoApi = {
  async createLetter(payload: CreateLetterPayload): Promise<LetterResponse> {
    const now = new Date().toISOString();
    const letter: DemoLetter = {
      id: randomSlug(),
      slug: randomSlug(),
      salutation: payload.salutation || 'My dearest',
      salutationEnabled: payload.salutationEnabled !== false,
      salutationFont: payload.salutationFont || 'cormorant',
      recipient: payload.recipient.trim(),
      content: sanitizeLetterHtml(payload.content),
      closing: payload.closing || 'Forever yours,',
      signature: payload.signature?.trim() || 'With love',
      sealType: payload.sealType,
      sealColor: payload.sealColor,
      crest: payload.crest || 'none',
      customInitials: (payload.customInitials || '').trim(),
      bodyFont: payload.bodyFont || 'eb-garamond',
      signatureFont: payload.signatureFont || 'great-vibes',
      flowers: payload.flowers || [],
      isPrivate: payload.isPrivate === true,
      demoPassword: payload.isPrivate ? payload.password : undefined,
      createdAt: now,
      updatedAt: now,
    };
    const letters = load();
    letters.push(letter);
    save(letters);
    return { success: true, data: publicView(letter, true) };
  },

  async getLetter(slug: string): Promise<LetterResponse> {
    const letter = load().find((entry) => entry.slug === slug);
    if (!letter) return { success: false, error: 'Letter not found (demo letters live only in this browser)' };
    return { success: true, data: publicView(letter, false) };
  },

  async unlockLetter(slug: string, password: string): Promise<LetterResponse> {
    const letter = load().find((entry) => entry.slug === slug);
    if (!letter) return { success: false, error: 'Letter not found' };
    if (letter.isPrivate && letter.demoPassword !== password) {
      return { success: false, error: 'Incorrect passphrase' };
    }
    return { success: true, data: publicView(letter, true) };
  },

  async deleteLetter(slug: string): Promise<LetterResponse> {
    const letters = load();
    const index = letters.findIndex((entry) => entry.slug === slug);
    if (index === -1) return { success: false, error: 'Letter not found' };
    letters.splice(index, 1);
    save(letters);
    return { success: true };
  },

  async listLetters(): Promise<LettersListResponse> {
    return { success: true, data: load().map((letter) => publicView(letter, !letter.isPrivate)) };
  },
};
