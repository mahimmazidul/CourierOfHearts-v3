import { OrnamentDivider, HeartSigilIcon } from '@/components/icons/SvgIcons';
import { usePageMeta } from '@/hooks/usePageMeta';

// Production privacy policy. Written to describe what the architecture
// actually does — no stronger claims than the system provides.
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What is stored',
    body: [
      'When you send a letter, the service stores the letter itself: its text, the recipient name and salutation you typed, the closing and signature, decoration choices (seal, crest, flowers, fonts, initials), and timestamps. Letters are stored in a SQLite database on the server.',
      'Letter bodies and personal fields are encrypted at rest. Every letter has its own random encryption key.',
    ],
  },
  {
    title: 'Password-protected letters',
    body: [
      'If you protect a letter with a passphrase, the letter\u2019s encryption key is wrapped using a key derived from your passphrase (Argon2id) and, separately, using a key derived from a one-time recovery token. Your plaintext passphrase is never stored, never logged, and is discarded after the letter is sealed.',
      'CourierOfHearts is NOT zero-knowledge and NOT end-to-end encrypted. Encryption and decryption happen on the server, so the server necessarily sees letter text while a letter is being written or read.',
    ],
  },
  {
    title: 'Operator recovery exists',
    body: [
      'Each protected letter has a unique recovery token. The raw token is sent once to the operator through a private Telegram chat and is not stored by the service. This means the operator, holding a letter\u2019s recovery token, can technically open that letter if recovery is used. There is no master password that opens every letter.',
    ],
  },
  {
    title: 'Telegram',
    body: [
      'The operator receives new-letter notifications (creation time, link, whether it is protected, flower count, and \u2014 for protected letters \u2014 the recovery token) and encrypted database backups through Telegram. Telegram is a third-party service with its own privacy practices; content shared with it leaves this server.',
      'Notifications never include your letter text or your passphrase.',
    ],
  },
  {
    title: 'Backups',
    body: [
      'The database is backed up daily. Backups are encrypted (AES-256-GCM) before leaving the server and encrypted copies may be delivered to the operator through Telegram. Local encrypted backups are kept for a limited retention window (14 days by default) and then deleted.',
    ],
  },
  {
    title: 'Logs and request data',
    body: [
      'Ordinary web server logs may record IP addresses, browser user-agent strings, request paths, timing and status codes for operations, security and abuse prevention. Letter bodies, passphrases and recovery tokens are not intentionally written to any log.',
    ],
  },
  {
    title: 'Links, sharing and search engines',
    body: [
      'A letter link contains a random, hard-to-guess address that reveals nothing about its contents. Anyone who possesses an unprotected letter\u2019s link can read that letter \u2014 protect a letter with a passphrase if it must stay private even when the link travels.',
      'Letter pages are marked not to be indexed by search engines and are excluded from the sitemap. Link previews on social apps show only generic CourierOfHearts artwork and text \u2014 never the letter, names, or any content.',
    ],
  },
  {
    title: 'Browser storage',
    body: [
      'Your browser keeps small first-party records so the experience works without accounts: management tokens for letters you wrote (localStorage) and an autosaved draft of an unfinished letter (IndexedDB, on your device only). No advertising cookies, no cross-site tracking, no fingerprinting, no analytics trackers.',
    ],
  },
  {
    title: 'Retention and deletion',
    body: [
      'Letters remain until they expire (if you set an expiry), until you delete them from “My Letters” on the device that wrote them, or until the operator removes them (for example on a valid deletion or abuse request). Deleted letters disappear from the live database immediately and age out of encrypted backups as the retention window passes.',
    ],
  },
  {
    title: 'The demo preview',
    body: [
      'The GitHub Pages preview (github.io) is a frontend-only demo. It talks to no production server and stores demo letters only inside your own browser. No production data exists there.',
    ],
  },
  {
    title: 'What this service will not do',
    body: [
      'Letter contents are not sold, not used for advertising, and not shared except as described above. If disclosure were ever legally compelled, only what the architecture actually holds could be produced: encrypted letters, and plaintext only where the service itself can decrypt (unprotected letters).',
    ],
  },
  {
    title: 'Honest limitations',
    body: [
      'A compromised server could read unprotected letters and could capture passphrases entered while it is compromised. Protected letters at rest are only as strong as the passphrase chosen and the Argon2id derivation. Treat CourierOfHearts as a heartfelt courier with good locks \u2014 not as a vault for state secrets.',
    ],
  },
];

export default function PrivacyPage({ onBack }: { onBack: () => void }) {
  usePageMeta({
    title: 'Privacy — Courier of Hearts',
    description: 'How CourierOfHearts stores, encrypts, backs up, and protects your letters — in plain language.',
    robots: 'index,follow',
  });

  return (
    <div className="min-h-screen parchment-bg">
      <nav className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4" style={{ borderBottom: '1px solid rgba(139,115,64,0.1)' }}>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.12em] text-ink/50 uppercase hover:text-ink/80 transition-colors duration-500">&larr; Home</button>
        <div className="flex items-center gap-2">
          <HeartSigilIcon size={18} color="#6B1025" />
          <span className="font-heading text-[10px] tracking-[0.2em] text-ink/55 uppercase hidden md:inline">Privacy</span>
        </div>
        <div className="w-16" />
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 relative z-10">
        <header className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-ink/88 mb-2">Privacy</h1>
          <p className="font-body text-[15px] md:text-[16px] text-ink/56 italic">Written plainly, so nothing is left to guessing.</p>
          <OrnamentDivider className="w-44 mx-auto mt-5" color="#8b7340" />
        </header>

        <article className="letter-paper rounded-sm px-5 py-6 md:px-8 md:py-9 space-y-6">
          <p className="font-body text-[15px] text-ink/68 leading-[1.9]">
            CourierOfHearts exists to carry letters between two people, without accounts and without
            surveillance. This page describes exactly what the service keeps, what it encrypts, who can
            technically see what, and where the limits are.
          </p>

          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-heading text-[11px] tracking-[0.18em] uppercase text-ink/64 mb-2">{section.title}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index} className="font-body text-[15px] text-ink/66 leading-[1.85] mb-2 last:mb-0">{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
