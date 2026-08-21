export type SealType = 'rose' | 'heart' | 'crown' | 'raven' | 'initials' | 'monogram';
export type SealColor = 'burgundy' | 'crimson' | 'emerald' | 'gold' | 'black';
export type CrestType = 'royal' | 'floral' | 'shield' | 'wreath' | 'wings' | 'none';
export type FontChoice =
  | 'eb-garamond' | 'cormorant' | 'crimson' | 'medieval' | 'uncial' | 'almendra'
  | 'marck' | 'parisienne' | 'noto-serif-bengali' | 'hind-siliguri'
  | 'galada' | 'tiro-bangla' | 'baloo-da-2';
export type SignatureFont = 'great-vibes' | 'satisfy' | 'dancing' | 'marck' | 'parisienne' | 'galada';

export interface FlowerPlacement {
  id: string;
  flowerId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

export interface Letter {
  id: string;
  slug: string;
  salutation: string;
  salutationEnabled: boolean;
  salutationFont?: FontChoice;
  recipient: string;
  content: string;
  closing: string;
  signature: string;
  sealType: SealType;
  sealColor: SealColor;
  crest: CrestType;
  customInitials: string;
  bodyFont: FontChoice;
  signatureFont: SignatureFont;
  flowers: FlowerPlacement[];
  isPrivate: boolean;
  requiresPassword?: boolean;
  views?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLetterPayload {
  salutation: string;
  salutationEnabled: boolean;
  salutationFont?: FontChoice;
  recipient: string;
  content: string;
  closing: string;
  signature: string;
  sealType: SealType;
  sealColor: SealColor;
  crest: CrestType;
  customInitials: string;
  bodyFont: FontChoice;
  signatureFont: SignatureFont;
  flowers: FlowerPlacement[];
  isPrivate: boolean;
  password?: string;
  expiresAt?: string;
}

export type UpdateLetterPayload = Partial<CreateLetterPayload>;

export interface LetterResponse {
  success: boolean;
  data?: Letter;
  error?: string;
  code?: string;
}

export interface LettersListResponse {
  success: boolean;
  data?: Letter[];
  error?: string;
}
