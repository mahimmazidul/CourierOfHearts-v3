import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:5173/');
const para = 'The candle has burned low and still I write these lines for you across the quiet night. প্রিয়তমা, আজ রাতে আকাশে অনেক তারা। ';
let content = '';
for (let i = 0; i < 10; i++) content += `<div>${i+1}. ${para.repeat(2)}</div><div><br></div>`;
const slug = await page.evaluate(async (c) => (await (await fetch('/api/v1/letters', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ salutation: 'প্রিয়', salutationEnabled: true, recipient: 'তুমি', content: c, closing: 'Warmly,', signature: 'A Friend', sealType: 'heart', sealColor: 'burgundy', crest: 'none', customInitials: '', bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: [], isPrivate: false }),
})).json()).data.slug, content);
await page.goto(`http://localhost:5173/#/letter/${slug}`);
await page.waitForTimeout(4700);
await page.locator('svg[role="button"]').click();
await page.waitForTimeout(4500); // reading, page 1 revealing

// SURPRISE: only page 1 visible; marker shows just "1"; no "of N" anywhere
const early = await page.evaluate(() => ({
  visibleArticles: [...document.querySelectorAll('article.print-letter')].filter(a => a.offsetParent !== null).length,
  mountedArticles: document.querySelectorAll('article.print-letter').length,
  markerTexts: [...document.querySelectorAll('article.print-letter span')].filter(s => /^\d/.test(s.textContent.trim())).map(s => s.textContent.trim()),
  scrollY: window.scrollY,
}));
console.log('while page 1 writes:', JSON.stringify(early));

// AUTO-FOLLOW: wait for ink to reach lower page; scrollY should grow
await page.waitForTimeout(6000);
const midScroll = await page.evaluate(() => window.scrollY);
console.log('auto-follow scrolled viewport down:', midScroll > 50, `(scrollY=${midScroll})`);

// page 2 turns open only after page 1 completes; ink starts at its top
await page.waitForTimeout(4000);
const later = await page.evaluate(() => ({
  visible: [...document.querySelectorAll('article.print-letter')].filter(a => a.offsetParent !== null).length,
  turning: document.querySelectorAll('article.page-open').length,
}));
console.log('after page 1 done:', JSON.stringify(later));

// settle all ink -> markers become "n of N"
await page.locator('article.print-letter').first().click();
await page.waitForTimeout(800);
const final = await page.evaluate(() => ({
  visible: [...document.querySelectorAll('article.print-letter')].filter(a => a.offsetParent !== null).length,
  markers: [...document.querySelectorAll('article.print-letter span')].filter(s => /^\d/.test(s.textContent.trim())).map(s => s.textContent.trim()),
  signature: !!document.body.textContent.includes('A Friend'),
}));
console.log('after settle:', JSON.stringify(final));

// PRINT SAFETY: fresh load, print IMMEDIATELY mid-reveal — all pages in PDF
await page.goto(`http://localhost:5173/#/letter/${slug}`);
await page.waitForTimeout(4700);
await page.locator('svg[role="button"]').click();
await page.waitForTimeout(4200); // page 1 mid-reveal, later pages hidden
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: '/tmp/midprint.pdf', format: 'A4', printBackground: false });
const { readFileSync } = await import('node:fs');
const pdfPages = (readFileSync('/tmp/midprint.pdf').toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
console.log('mid-animation print: PDF pages =', pdfPages, '(must equal total, not 1)');
await browser.close();
