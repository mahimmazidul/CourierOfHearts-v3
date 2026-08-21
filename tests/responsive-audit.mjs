// Responsive QA: viewport matrix overflow + key control visibility checks.
import { chromium } from 'playwright';

const VIEWPORTS = [
  [320, 568], [360, 800], [375, 667], [390, 844], [393, 873], [412, 915], [430, 932],
  [768, 1024], [820, 1180], [1024, 1366],
  [1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440],
  // landscape phone
  [844, 390],
];
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
const issues = [];

// prepare a letter for the delivered view
await page.goto(BASE);
const created = await page.evaluate(async () => (await (await fetch('/api/v1/letters', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ salutation: 'প্রিয়', salutationEnabled: true, recipient: 'Maria', content: '<div>দীর্ঘ বাংলা অনুচ্ছেদ: যুক্তাক্ষর ক্ষ জ্ঞ শ্রী ❤️ and a long English sentence to stretch the line width considerably for overflow testing purposes.</div>', closing: 'ইতি,', signature: 'M', sealType: 'heart', sealColor: 'burgundy', crest: 'none', customInitials: 'অ', bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: Array.from({length: 15},(_,i)=>({id:'f'+i,flowerId:'rose',x:(i*19)%90+5,y:(i*29)%90+5,size:40,rotation:0})), isPrivate: false }),
})).json()).data.slug);

const routes = [ ['home', '/'], ['compose', '/#/compose'], ['delivered', `/#/letter/${created}`] ];

for (const [w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h });
  for (const [name, route] of routes) {
    await page.goto(`${BASE}${route}`);
    await page.waitForTimeout(name === 'delivered' ? 3600 : 700);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) issues.push(`${w}x${h} ${name}: horizontal overflow ${overflow}px`);
    if (name === 'compose') {
      const editorVisible = await page.locator('.rich-letter-editor').isVisible().catch(() => false);
      if (!editorVisible) issues.push(`${w}x${h} compose: editor not visible`);
      // touch target sanity for toolbar buttons on touch sizes
      if (w <= 430) {
        const small = await page.evaluate(() => [...document.querySelectorAll('.editor-tool')]
          .filter(b => b.offsetParent && (b.offsetWidth < 32 || b.offsetHeight < 32)).length);
        if (small) issues.push(`${w}x${h} compose: ${small} toolbar buttons under 32px`);
      }
    }
    if (name === 'delivered') {
      const seal = await page.locator('svg[role="button"]').isVisible().catch(() => false);
      if (!seal) issues.push(`${w}x${h} delivered: seal not tappable/visible`);
    }
  }
  process.stdout.write(`${w}x${h} ok\n`);
}
console.log('--- ISSUES ---');
console.log(issues.length ? issues.join('\n') : 'none');
await browser.close();
