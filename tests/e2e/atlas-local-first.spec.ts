import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Backup } from '../../src/domain/types';

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Atlas sidebar' });
const details = (page: Page) => page.getByRole('complementary', { name: 'Place details' });
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search places, regions, tags' });

async function openSidebar(page: Page): Promise<void> {
  if (!(await sidebar(page).isVisible())) {
    await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
  }
  await expect(sidebar(page)).toBeVisible();
}

async function openAtlas(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveTitle(/Leonida Atlas/);
  await expect(
    page.getByRole('region', { name: 'Leonida interactive map', exact: true }),
  ).toBeVisible();
  const basemap = page.getByRole('img', {
    name: 'Approximate GTADB community reconstruction of Leonida',
  });
  await expect(basemap).toBeVisible();
  await expect(basemap).toHaveJSProperty('complete', true);
  expect(
    await basemap.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Add marker', exact: true })).toBeEnabled();
}

async function selectRegion(page: Page, name = 'Ambrosia'): Promise<void> {
  await openSidebar(page);
  await sidebar(page).getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByLabel('Browse categories').selectOption('region');
  await search(page).fill(name);
  await page
    .locator('.place-results')
    .getByRole('button', { name: new RegExp(`^${name} Region`) })
    .click();
  await expect(details(page).getByRole('heading', { name, exact: true })).toBeVisible();
}

async function createCollection(page: Page, name: string): Promise<void> {
  await openSidebar(page);
  await sidebar(page).getByRole('button', { name: 'Saved', exact: true }).click();
  await page.getByLabel('Collection name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  await expect(page.getByRole('button', { name: `Rename ${name}`, exact: true })).toBeVisible();
}

async function createMarker(page: Page, title: string): Promise<void> {
  if (await page.getByRole('button', { name: 'Close sidebar', exact: true }).isVisible()) {
    await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add marker', exact: true }).click();
  await page.getByRole('button', { name: 'Enter coordinates', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'New personal marker', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Title', { exact: true }).fill(title);
  await editor.getByLabel('Description', { exact: true }).fill('A private map annotation');
  await editor.getByLabel('Game X', { exact: true }).fill('-1200');
  await editor.getByLabel('Game Y', { exact: true }).fill('900');
  await editor.getByLabel('Icon', { exact: true }).selectOption('flag');
  await editor.getByRole('button', { name: 'Save marker', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(details(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openBackup(page: Page): Promise<void> {
  if (await page.getByRole('dialog', { name: 'Your local backup', exact: true }).isVisible())
    return;
  if (await details(page).isVisible()) {
    await page.getByRole('button', { name: 'Close place details', exact: true }).click();
  }
  await openSidebar(page);
  await sidebar(page).getByRole('button', { name: 'Backup', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your local backup', exact: true })).toBeVisible();
}

async function exportBackup(page: Page, testInfo: TestInfo, label: string): Promise<Backup> {
  await openBackup(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloading;
  const path = `/tmp/atlas-qa-backup-${testInfo.project.name}-${label}.json`;
  await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Backup;
}

function savedData(backup: Backup) {
  return {
    favorites: backup.favorites,
    notes: backup.notes,
    markers: backup.markers,
    collections: backup.collections,
    preferences: backup.preferences,
  };
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const name = testInfo.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 90);
    await page.screenshot({
      path: `/tmp/atlas-qa-${testInfo.project.name}-${name}-failed.png`,
      fullPage: true,
    });
  }
});

test('the map opens without an account, filters public evidence, and toggles visible layers', async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== new URL(testInfo.project.use.baseURL!).origin
    ) {
      externalRequests.push(request.url());
    }
  });
  await openAtlas(page);
  await page.screenshot({
    path: `/tmp/atlas-qa-${testInfo.project.name}-initial-map.png`,
    fullPage: true,
  });
  await openSidebar(page);
  await expect(
    sidebar(page).getByRole('heading', { name: 'LEONIDA ATLAS', exact: true }),
  ).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.getByLabel('Browse categories').selectOption('region');
  await expect(page.locator('.place-results .place-result').first()).toContainText(
    'Region · approximate',
  );
  await page.getByLabel('Evidence filter').selectOption('uncertain');
  await expect(page.getByText('No places match these filters.', { exact: false })).toBeVisible();
  await page.getByLabel('Browse categories').selectOption('all');
  await expect(page.locator('.place-results .place-result').first()).toContainText(
    'Uncertain · approximate',
  );
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await selectRegion(page);
  await page.getByRole('button', { name: 'Close place details', exact: true }).click();
  await openSidebar(page);
  await sidebar(page).getByRole('button', { name: 'Layers', exact: true }).click();
  const regionLayer = page.getByRole('checkbox', { name: /^Named regions/ });
  await expect(regionLayer).toBeChecked();
  await regionLayer.uncheck();
  await expect(regionLayer).not.toBeChecked();
  await expect(page.locator('.atlas-map-caption')).toHaveText('0 places in view');
  await regionLayer.check();
  await expect(page.locator('.atlas-map-caption')).toHaveText('1 places in view');
  await page.screenshot({
    path: `/tmp/atlas-qa-${testInfo.project.name}-layers.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('a renamed collection, favorite and note survive a browser reload', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createCollection(page, 'Weekend route');
  await page.getByRole('button', { name: 'Rename Weekend route', exact: true }).click();
  await page.getByLabel('Collection name', { exact: true }).fill('Sunset route');
  await page.getByRole('button', { name: 'Save collection name', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Rename Sunset route', exact: true }),
  ).toBeVisible();
  await selectRegion(page);
  await details(page).getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await expect(
    details(page).getByRole('button', { name: 'Saved to favorites', exact: true }),
  ).toBeVisible();
  await details(page)
    .getByLabel('Notes', { exact: true })
    .fill('Return to Ambrosia before sunset.');
  await details(page).getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await details(page)
    .getByLabel('Add to collection', { exact: true })
    .selectOption({ label: 'Sunset route' });
  await expect(
    details(page).getByRole('button', { name: 'Remove from Sunset route', exact: true }),
  ).toBeVisible();
  await page.reload();
  await selectRegion(page);
  await expect(
    details(page).getByRole('button', { name: 'Saved to favorites', exact: true }),
  ).toBeVisible();
  await expect(details(page).getByLabel('Notes', { exact: true })).toHaveValue(
    'Return to Ambrosia before sunset.',
  );
  await expect(
    details(page).getByRole('button', { name: 'Remove from Sunset route', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/atlas-qa-${testInfo.project.name}-saved-place.png`,
    fullPage: true,
  });
});

test('a personal marker can be edited, moved and deleted with its saved references', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createCollection(page, 'Personal trip');
  await createMarker(page, 'Quiet beach');
  await details(page).getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await expect(
    details(page).getByRole('button', { name: 'Saved to favorites', exact: true }),
  ).toBeVisible();
  await details(page)
    .getByLabel('Notes', { exact: true })
    .fill('A private note to remove with this marker.');
  await details(page).getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await details(page)
    .getByLabel('Add to collection', { exact: true })
    .selectOption({ label: 'Personal trip' });
  await expect(
    details(page).getByRole('button', { name: 'Remove from Personal trip', exact: true }),
  ).toBeVisible();
  await details(page).getByRole('button', { name: 'Edit marker', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Edit personal marker', exact: true });
  await editor.getByLabel('Title', { exact: true }).fill('Quiet beach overlook');
  await editor.getByRole('button', { name: 'Save marker', exact: true }).click();
  await expect(
    details(page).getByRole('heading', { name: 'Quiet beach overlook', exact: true }),
  ).toBeVisible();
  await details(page).getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('button', { name: 'Enter coordinates', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Edit personal marker', exact: true });
  await editor.getByLabel('Game X', { exact: true }).fill('-1000');
  await editor.getByLabel('Game Y', { exact: true }).fill('1200');
  await editor.getByRole('button', { name: 'Save marker', exact: true }).click();
  await expect(details(page)).toContainText('-1000.0, 1200.0');
  await page.reload();
  await openSidebar(page);
  await search(page).fill('Quiet beach overlook');
  await page
    .locator('.place-results')
    .getByRole('button', { name: /^Quiet beach overlook Personal marker/ })
    .click();
  await expect(details(page)).toContainText('-1000.0, 1200.0');
  await details(page).getByRole('button', { name: 'Edit marker', exact: true }).click();
  editor = page.getByRole('dialog', { name: 'Edit personal marker', exact: true });
  await editor.getByRole('button', { name: 'Delete marker', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(details(page)).not.toBeVisible();
  const backup = await exportBackup(page, testInfo, 'deleted-marker');
  expect(backup.markers).toEqual([]);
  expect(backup.favorites).toEqual([]);
  expect(backup.notes).toEqual([]);
  expect(backup.collections).toHaveLength(1);
  expect(backup.collections[0]).toMatchObject({ name: 'Personal trip', placeIds: [] });
});

test('backup validation and preview preserve current data until a confirmed merge', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createMarker(page, 'Keep this marker');
  const original = await exportBackup(page, testInfo, 'original');
  expect(original).toMatchObject({ format: 'leonida-atlas', version: 2 });
  expect(original.markers).toHaveLength(1);
  const fileInput = page.getByLabel('Import a backup', { exact: true });
  await fileInput.setInputFiles({
    name: 'unsupported.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...original, version: 999 })),
  });
  await expect(page.getByRole('alert')).toContainText('version');
  await expect(page.getByRole('button', { name: 'Merge backup', exact: true })).not.toBeVisible();
  expect(savedData(await exportBackup(page, testInfo, 'after-invalid'))).toEqual(
    savedData(original),
  );
  const imported = structuredClone(original);
  imported.markers.push({
    ...original.markers[0]!,
    id: 'custom:imported-stop',
    title: 'Imported stop',
    position: { x: -800, y: 1000 },
  });
  await fileInput.setInputFiles({
    name: 'valid-preview.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.getByRole('region', { name: 'Backup preview', exact: true })).toContainText(
    '2 markers',
  );
  expect(savedData(await exportBackup(page, testInfo, 'before-merge'))).toEqual(
    savedData(original),
  );
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Merge backup', exact: true })).not.toBeVisible();
  await fileInput.setInputFiles({
    name: 'valid-confirmed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await expect(
    page.getByText('Backup merged. Your local data is saved.', { exact: true }),
  ).toBeVisible();
  const merged = await exportBackup(page, testInfo, 'after-merge');
  expect(merged.markers.map((marker) => marker.title).sort()).toEqual([
    'Imported stop',
    'Keep this marker',
  ]);
  await page.screenshot({
    path: `/tmp/atlas-qa-${testInfo.project.name}-backup.png`,
    fullPage: true,
  });
});

test('the installed app reloads offline with its saved preferences and personal data', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.setTimeout(60_000);
  await openAtlas(page);
  await createMarker(page, 'Offline stop');
  await page.getByRole('button', { name: 'Close place details', exact: true }).click();
  await openSidebar(page);
  await sidebar(page).getByRole('button', { name: 'Settings', exact: true }).click();
  const reducedMotion = page.getByRole('checkbox', { name: /^Reduce motion/ });
  await reducedMotion.click();
  await expect(reducedMotion).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
    undefined,
    { timeout: 30_000 },
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  try {
    try {
      await page.reload();
    } catch (error) {
      if (
        browserName === 'webkit' &&
        error instanceof Error &&
        error.message.includes('WebKit encountered an internal error')
      ) {
        test.skip(
          true,
          'Playwright WebKit fails offline service-worker navigation with an internal browser error; Chromium verifies cached reload. https://playwright.dev/docs/service-workers',
        );
      }
      throw error;
    }
    const basemap = page.getByRole('img', {
      name: 'Approximate GTADB community reconstruction of Leonida',
    });
    await expect(basemap).toHaveJSProperty('complete', true);
    expect(
      await basemap.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    // Playwright 1.62 can incorrectly expose navigator.onLine=true after an offline reload.
    // Prove the network is actually unavailable instead of using that emulated flag.
    // https://github.com/microsoft/playwright/issues/42174
    expect(
      await page.evaluate(() =>
        fetch('/atlas-offline-network-proof', { cache: 'no-store' }).then(
          () => false,
          () => true,
        ),
      ),
    ).toBe(true);
    await openSidebar(page);
    await search(page).fill('Offline stop');
    await page
      .locator('.place-results')
      .getByRole('button', { name: /^Offline stop Personal marker/ })
      .click();
    await expect(
      details(page).getByRole('heading', { name: 'Offline stop', exact: true }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await page.screenshot({
      path: `/tmp/atlas-qa-${testInfo.project.name}-offline.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Close place details', exact: true }).click();
    await selectRegion(page);
    await expect(
      details(page).getByRole('heading', { name: 'Ambrosia', exact: true }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('keyboard search and modal dismissal preserve focus and usable navigation', async ({
  page,
}) => {
  await openAtlas(page);
  await page.getByRole('region', { name: 'Leonida interactive map', exact: true }).focus();
  await page.keyboard.press('/');
  await expect(search(page)).toBeFocused();
  await search(page).fill('Ambrosia');
  const settings = sidebar(page).getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'Atlas settings', exact: true });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab');
    // Native dialogs may send Tab through browser chrome, represented as body focus.
    // The application behind the modal must never receive keyboard focus.
    expect(
      await dialog.evaluate(
        (element) =>
          document.activeElement === document.body || element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(settings).toBeFocused();
});

test('blocked local storage keeps the public map usable and never reports a successful save', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Leonida interactive map', exact: true }),
  ).toBeVisible();
  await openSidebar(page);
  await expect(page.getByText('Local storage needs attention', { exact: true })).toBeVisible();
  await expect(page.getByText('Local data saved', { exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Add marker', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry storage', exact: true }).click();
  await expect(page.getByText('Local storage needs attention', { exact: true })).toBeVisible();
  await selectRegion(page);
  await expect(details(page).getByRole('heading', { name: 'Ambrosia', exact: true })).toBeVisible();
  await expect(
    details(page).getByRole('button', { name: 'Add to favorites', exact: true }),
  ).toBeDisabled();
  await expect(details(page).getByLabel('Notes', { exact: true })).toBeDisabled();
});

test('clean note editors synchronize across tabs without overwriting newer saved text', async ({
  page,
  context,
}) => {
  await openAtlas(page);
  await selectRegion(page);
  const second = await context.newPage();
  try {
    await openAtlas(second);
    await selectRegion(second);
    await details(second).getByLabel('Notes', { exact: true }).fill('Written in the second tab.');
    await details(second).getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(details(second).getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    const firstNote = details(page).getByLabel('Notes', { exact: true });
    await expect(firstNote).toHaveValue('Written in the second tab.');
    await firstNote.focus();
    await details(page).getByRole('heading', { name: 'Ambrosia', exact: true }).click();
    await second.reload();
    await selectRegion(second);
    await expect(details(second).getByLabel('Notes', { exact: true })).toHaveValue(
      'Written in the second tab.',
    );
  } finally {
    await second.close();
  }
});

test('notes saved offline remain available after reconnecting and reloading', async ({
  page,
  context,
}) => {
  await openAtlas(page);
  await selectRegion(page);
  await context.setOffline(true);
  try {
    await details(page)
      .getByLabel('Notes', { exact: true })
      .fill('Saved while the connection was unavailable.');
    await details(page).getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(details(page).getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.reload();
  await selectRegion(page);
  await expect(details(page).getByLabel('Notes', { exact: true })).toHaveValue(
    'Saved while the connection was unavailable.',
  );
});

test('3D explorer spawns at the selected Ambrosia position instead of Vice City', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'World-spawn verification uses the Chromium WebGL renderer.',
  );
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openAtlas(page);
  await selectRegion(page, 'Ambrosia');
  await page.getByRole('button', { name: '3D explorer', exact: true }).click();
  await expect(page).toHaveURL(/view=3d&place=region%3Aambrosia/);
  const world = page.locator('[data-walk-world]');
  await expect(world).toHaveAttribute('data-walk-runtime', 'ready', { timeout: 60_000 });
  await expect(world).toHaveAttribute('data-walk-map-travel-id', 'region:ambrosia');
  const spawn = await world.evaluate((element) => {
    const root = element as HTMLElement;
    const destination = JSON.parse(root.dataset.initialDestination!);
    return { x: Number(root.dataset.playerX), z: Number(root.dataset.playerZ), destination };
  });
  expect(Math.hypot(spawn.x - spawn.destination.x, spawn.z - spawn.destination.z)).toBeLessThan(75);
  expect(Math.hypot(spawn.x + 849.814, spawn.z - 651.22)).toBeGreaterThan(1000);
  await expect(page.locator('[data-atlas-arrival-notice]')).toContainText('Ambrosia');

  // Native toolbar activation must work while walking shortcuts are active.
  await page.getByRole('button', { name: 'Evidence', exact: true }).focus();
  await page.keyboard.press('Enter');
  const evidence = page.getByRole('dialog', { name: 'What is known', exact: true });
  await expect(evidence).toBeVisible();
  await expect(evidence.locator('[data-research-discovery]')).toHaveCount(15);
  const keysResearch = evidence.locator('details').filter({
    has: page.locator('summary').filter({ hasText: 'Leonida Keys' }),
  });
  await keysResearch.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(keysResearch).toHaveAttribute('open', '');
  await expect(
    keysResearch.getByRole('link', { name: 'Rockstar — Leonida Keys 06', exact: true }),
  ).toHaveAttribute(
    'href',
    'https://www.rockstargames.com/VI/_next/static/media/Leonida_Keys_06.0eapr3hbeyewx.jpg',
  );
  await keysResearch
    .getByRole('button', { name: 'Explore the region: Leonida Keys', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(evidence).not.toBeVisible();
  await expect(world.locator('[data-walk-zone]')).toHaveText('Leonida Keys');
  // This is the existing approximate regional arrival, not a new research pin.
  const researchArrival = await world.evaluate((element) => ({
    x: Number((element as HTMLElement).dataset.playerX),
    z: Number((element as HTMLElement).dataset.playerZ),
  }));
  expect(Math.hypot(researchArrival.x + 9830.96197, researchArrival.z - 6677.24481))
    .toBeLessThan(75);

  await page.getByRole('button', { name: 'Back to atlas', exact: true }).click();
  await selectRegion(page, 'Leonida Keys');
  await page.getByRole('button', { name: '3D explorer', exact: true }).click();
  await expect(world).toHaveAttribute('data-walk-runtime', 'ready', { timeout: 60_000 });
  await expect(world).toHaveAttribute('data-walk-map-travel-id', 'region:leonida-keys');
  expect(pageErrors).toEqual([]);
});
