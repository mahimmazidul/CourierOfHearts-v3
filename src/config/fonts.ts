import type { FontChoice, SignatureFont } from '@/types/letter';

export const BODY_FONTS: { value: FontChoice; label: string; family: string }[] = [
  { value: 'eb-garamond', label: 'EB Garamond', family: "'EB Garamond', 'Noto Serif Bengali', serif" },
  { value: 'cormorant', label: 'Cormorant', family: "'Cormorant Garamond', 'Noto Serif Bengali', serif" },
  { value: 'crimson', label: 'Crimson Pro', family: "'Crimson Pro', 'Noto Serif Bengali', serif" },
  { value: 'medieval', label: 'MedievalSharp', family: "'MedievalSharp', 'Noto Serif Bengali', cursive" },
  { value: 'uncial', label: 'Uncial Antiqua', family: "'Uncial Antiqua', 'Noto Serif Bengali', serif" },
  { value: 'almendra', label: 'Almendra', family: "'Almendra', 'Noto Serif Bengali', serif" },
  { value: 'marck', label: 'Marck Script', family: "'Marck Script', 'Hind Siliguri', cursive" },
  { value: 'parisienne', label: 'Parisienne', family: "'Parisienne', 'Hind Siliguri', cursive" },
  { value: 'noto-serif-bengali', label: 'নত সেরিফ বাংলা', family: "'Noto Serif Bengali', 'EB Garamond', serif" },
  { value: 'hind-siliguri', label: 'হিন্দ শিলিগুড়ি', family: "'Hind Siliguri', 'EB Garamond', sans-serif" },
  { value: 'galada', label: 'গলদা', family: "'Galada', 'Great Vibes', cursive" },
  { value: 'tiro-bangla', label: 'টিরো বাংলা', family: "'Tiro Bangla', 'EB Garamond', serif" },
  { value: 'baloo-da-2', label: 'বালু দা', family: "'Baloo Da 2', 'Hind Siliguri', sans-serif" },
];

export const SIG_FONTS: { value: SignatureFont; label: string; family: string }[] = [
  { value: 'great-vibes', label: 'Great Vibes', family: "'Great Vibes', 'Hind Siliguri', cursive" },
  { value: 'galada', label: 'গলদা', family: "'Galada', 'Great Vibes', cursive" },
  { value: 'satisfy', label: 'Satisfy', family: "'Satisfy', 'Hind Siliguri', cursive" },
  { value: 'dancing', label: 'Dancing Script', family: "'Dancing Script', 'Hind Siliguri', cursive" },
  { value: 'marck', label: 'Marck Script', family: "'Marck Script', 'Hind Siliguri', cursive" },
  { value: 'parisienne', label: 'Parisienne', family: "'Parisienne', 'Hind Siliguri', cursive" },
];

export function getFontFamilyByChoice(font: FontChoice): string {
  return BODY_FONTS.find((entry) => entry.value === font)?.family || "'EB Garamond', 'Noto Serif Bengali', serif";
}

export function getSigFontFamilyByChoice(font: SignatureFont): string {
  return SIG_FONTS.find((entry) => entry.value === font)?.family || "'Great Vibes', 'Hind Siliguri', cursive";
}

// Salutations: presets in English and Bangla; free text also allowed.
export const SALUTATIONS = [
  'My dearest', 'My beloved', 'My darling', 'To my love', 'My sweet', 'Dear', 'My heart',
  'প্রিয়', 'প্রিয়তমা', 'আমার ভালোবাসা',
];

export const CLOSINGS = [
  'Forever yours,', 'With all my love,', 'Yours always,', 'Eternally yours,',
  'With devotion,', 'All my heart,', 'Until we meet again,',
  'ইতি, তোমারই', 'ভালোবাসা রইল,',
];
