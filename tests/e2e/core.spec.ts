import { test, expect, type Page } from '@playwright/test';

// Core CourierOfHearts v3 flow, per the v3 acceptance list.

async function gotoCompose(page: Page) {
  await page.goto('/#/compose');
  await page.waitForSelector('.rich-letter-editor');
}

test.describe('CourierOfHearts v3', () => {
  test('homepage renders without the spacing typo and with clean console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await expect(page.getByText('Send a letter')).toBeVisible();
    const hero = await page.getByText('Seal it with wax').innerText();
    expect(hero.replace(/\n/g, ' ')).toMatch(/wax\.\s+Send/);
    expect(errors).toEqual([]);
  });

  test('compose placeholder has no literal \\A\\A', async ({ page }) => {
    await gotoCompose(page);
    const placeholder = await page.locator('.editor-placeholder').innerText();
    expect(placeholder).not.toContain('\\A');
    expect(placeholder).toContain('Write from the depths of your heart');
  });

  test('full flow: write (EN+BN+emoji), format, flowers, seal, send, ceremony, reload', async ({ page }) => {
    test.slow();
    await gotoCompose(page);

    // English + Bangla + emoji, with formatting
    await page.click('.rich-letter-editor');
    await page.keyboard.type('Tonight the moon 🌙 listened. ');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('আমি তোমাকে ভালোবাসি');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type(' ❤️');
    await expect(page.locator('.rich-letter-editor b, .rich-letter-editor strong')).toContainText('ভালোবাসি');

    await page.fill('input[aria-label="Recipient"]', 'Maria');
    await page.fill('input[aria-label="Signature"]', 'M');

    // On mobile the seal/flower panels sit behind tabs.
    const sealTab = page.getByRole('button', { name: 'Seal', exact: true });
    const isMobile = await sealTab.isVisible();
    if (isMobile) await sealTab.click();
    await page.fill('input[aria-label="Custom seal initials"]', 'MR');
    if (isMobile) await page.getByRole('button', { name: 'Flowers', exact: true }).click();

    // Flowers: add several, remove one
    const addRose = page.locator('button[aria-label="Add Rose"]');
    for (let i = 0; i < 6; i += 1) await addRose.click();
    if (isMobile) await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.locator('.group.touch-none')).toHaveCount(6);
    await page.locator('.group.touch-none').first().evaluate((el) => (el as HTMLElement).click());
    await page.locator('.coh-flower-remove').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('.group.touch-none')).toHaveCount(5);

    // Many flowers: no blank page
    if (isMobile) await page.getByRole('button', { name: 'Flowers', exact: true }).click();
    await page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Add "]'));
      for (let i = 0; i < 120; i += 1) {
        buttons[i % buttons.length].click();
        if (i % 30 === 0) await new Promise((r) => setTimeout(r));
      }
    });
    if (isMobile) await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.locator('.group.touch-none')).toHaveCount(125);
    expect(await page.evaluate(() => document.body.innerText.trim().length)).toBeGreaterThan(0);

    // Preview shows engraved emoji
    await page.getByRole('button', { name: 'Preview Letter' }).last().click();
    await expect(page.locator('.coh-emoji').first()).toBeVisible({ timeout: 10_000 });

    // Send
    await page.getByRole('button', { name: 'Seal & Send' }).last().click();
    await expect(page).toHaveURL(/#\/preview\/a-little-letter-/, { timeout: 15_000 });
    const shareUrl = await page.locator('input[readonly]').inputValue();
    const slug = shareUrl.split('#/letter/')[1];
    expect(slug).toMatch(/^a-little-letter-/);

    // Ceremony
    await page.goto(`/#/letter/${slug}`);
    await page.waitForTimeout(3400);
    const seal = page.locator('svg[role="button"]');
    await expect(seal).toBeVisible();
    await seal.click();
    await expect(page.getByText('Forever yours,')).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('.coh-emoji').count()).toBeGreaterThan(0);

    // Reload keeps the letter readable
    await page.reload();
    await page.waitForTimeout(3400);
    await expect(page.locator('svg[role="button"]')).toBeVisible();
  });

  test('draft autosave and restoration', async ({ page }) => {
    await gotoCompose(page);
    await page.click('.rich-letter-editor');
    await page.keyboard.type('A draft the wind should not steal');
    await page.waitForTimeout(1400); // debounce
    await page.reload();
    await page.waitForSelector('.rich-letter-editor');
    await expect(page.getByText('unfinished letter was waiting')).toBeVisible();
    await expect(page.locator('.rich-letter-editor')).toContainText('A draft the wind should not steal');
    // clean up for other tests
    await page.getByRole('button', { name: 'Start fresh' }).click();
  });

  test('protected letter: wrong password, right password, recovery entrance', async ({ page, request }) => {
    const create = await request.post('/api/v1/letters', {
      data: {
        salutation: 'My dearest', salutationEnabled: true, recipient: 'Maria',
        content: 'A secret between two hearts.', closing: 'Yours,', signature: 'M',
        sealType: 'rose', sealColor: 'crimson', crest: 'none', customInitials: '',
        bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: [],
        isPrivate: true, password: 'rosewater',
      },
    });
    const { data } = await create.json();

    await page.goto(`/#/letter/${data.slug}`);
    await expect(page.getByText('This letter is sealed')).toBeVisible();

    await page.fill('input[aria-label="Letter passphrase"]', 'wrong-guess');
    await page.getByRole('button', { name: 'Break the Seal' }).click();
    await expect(page.getByText('Incorrect passphrase.')).toBeVisible();

    // Recovery entrance exists but stays quiet
    await page.getByRole('button', { name: "keeper's key" }).click();
    await expect(page.getByPlaceholder('COH-RCV-...')).toBeVisible();
    await page.getByRole('button', { name: 'back to passphrase' }).click();

    await page.fill('input[aria-label="Letter passphrase"]', 'rosewater');
    await page.getByRole('button', { name: 'Break the Seal' }).click();
    await expect(page.getByText('A letter has arrived')).toBeVisible({ timeout: 10_000 });
  });

  test('privacy and thanks pages render', async ({ page }) => {
    await page.goto('/#/privacy');
    await expect(page.getByText('Operator recovery exists')).toBeVisible();
    await expect(page.getByText('NOT zero-knowledge')).toBeVisible();
    await page.goto('/#/thanks');
    await expect(page.getByText('Special Thanks')).toBeVisible();
  });

  test('clean path /letter/<slug> routes into the app', async ({ page, request }) => {
    const create = await request.post('/api/v1/letters', {
      data: {
        salutation: 'Dear', salutationEnabled: true, recipient: 'Path Tester',
        content: 'Clean routes work.', closing: 'Yours,', signature: 'P',
        sealType: 'heart', sealColor: 'gold', crest: 'none', customInitials: '',
        bodyFont: 'eb-garamond', signatureFont: 'great-vibes', flowers: [], isPrivate: false,
      },
    });
    const { data } = await create.json();
    await page.goto(`/letter/${data.slug}`);
    await expect(page.getByText('for Path Tester')).toBeVisible({ timeout: 10_000 });
  });
});
