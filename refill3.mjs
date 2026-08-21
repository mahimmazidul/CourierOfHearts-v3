import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
await page.goto('http://localhost:5173/');
const para = 'The candle has burned low and still I write these lines for you, my love, across the long quiet of the night. প্রিয়তমা, আজ রাতে আকাশে অনেক তারা, আর প্রতিটি তারার নাম আমি তোমার নামে রেখেছি। ';
let content = '';
for (let i = 0; i < 26; i++) content += `<div>${i+1}. ${para.repeat(2)}</div><div><br></div>`;
content += `<div>hey, "you do"?</div><div><br></div><div>${para.repeat(2)}</div>`;
const slug = await page.evaluate(async (c) => (await (await fetch('/api/v1/letters', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ salutation: 'প্রিয়', salutationEnabled: true, recipient: 'তুমি', content: c, closing: 'ইতি,', signature: 'M', sealType: 'heart', sealColor: 'burgundy', crest: 'none', customInitials: '', bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: [], isPrivate: false }),
})).json()).data.slug, content);
await page.goto(`http://localhost:5173/#/letter/${slug}`);
await page.waitForTimeout(4700);
await page.locator('svg[role="button"]').click();
await page.waitForTimeout(4200);
await page.locator('article.print-letter').first().click();
await page.waitForTimeout(1000);
const pages = await page.locator('article.print-letter').count();
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);
const stats = await page.evaluate(() => [...document.querySelectorAll('article.print-letter')].map(a => {
  const body = a.querySelector('.rich-letter-content');
  const kids = [...body.children];
  const last = kids[kids.length - 1] || body;
  return Math.round((last.getBoundingClientRect().bottom - a.getBoundingClientRect().top) / a.getBoundingClientRect().height * 100);
}));
console.log('pages:', pages, '| fill %:', JSON.stringify(stats), '| max (must be ≤ 93):', Math.max(...stats.slice(0, -1)));
const ends = await page.evaluate(() => [...document.querySelectorAll('article.print-letter .rich-letter-content')].map(b => (b.textContent||'').trim().slice(-16)));
console.log('short line intact somewhere:', ends.some(e => e.includes('you do')) || (await page.evaluate(() => document.body.textContent.includes('hey, "you do"?'))));
await page.pdf({ path: '/tmp/refill3.pdf', format: 'A4', printBackground: true });
const { readFileSync } = await import('node:fs');
console.log('PDF pages:', (readFileSync('/tmp/refill3.pdf').toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length);
await browser.close();
