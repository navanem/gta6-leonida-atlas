import { expect, test, type Page } from '@playwright/test';

async function openAtlasMap(page: Page): Promise<void> {
  await page.locator('[data-open-walk-map]:visible').first().click();
}

test('an early map tap is kept while the 3D runtime loads', async ({ page }) => {
  await page.route(/\/walk-world[^/]*\.(?:js|ts)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto('/gta6-leonida-atlas/app');
  const world = page.locator('[data-walk-world]');
  const map = page.locator('[data-walk-map]');
  await expect(map).not.toBeVisible();
  await openAtlasMap(page);
  await expect(map).toBeVisible();
  await page.locator('[data-walk-map-svg]').click({ position: { x: 500, y: 340 } });
  await expect(world).toHaveAttribute('data-walk-ready', 'true', { timeout: 20000 });
  await expect(world).toHaveAttribute('data-walk-map-travel-source', 'map');
  await expect(map).not.toBeVisible();
});

test('Atlas opens as an explore-first full-viewport app and Map stays fullscreen', async ({
  page,
}) => {
  await page.goto('/gta6-leonida-atlas/app');
  const shell = page.locator('[data-street-shell]');
  const map = page.locator('[data-walk-map]');
  await expect(shell).toHaveAttribute('data-atlas-standalone', 'true');
  await expect(shell).toHaveAttribute('data-walk-expanded', 'true');
  await expect(map).not.toBeVisible();
  await openAtlasMap(page);
  await expect(map).toBeVisible();
  await expect(page.locator('[data-walk-map-svg] image[data-atlas-basemap]')).toBeAttached();
  await expect(page.locator('[data-walk-map-zoom-value]')).toHaveText('100%');
  const viewport = page.viewportSize()!;
  const bounds = await shell.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.y).toBe(0);
  expect(bounds?.width).toBe(viewport.width);
  expect(bounds?.height).toBe(viewport.height);
  const player = await page.locator('[data-walk-map-player]').boundingBox();
  expect(player!.height).toBeGreaterThan(22);
  await page.keyboard.press('Escape');
  await expect(map).not.toBeVisible();
  await expect(shell).toHaveAttribute('data-walk-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-walk-expanded', 'true');
});

test('mobile starts in Explore and opens a practical fullscreen map drawer on demand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gta6-leonida-atlas/app');
  const map = page.locator('[data-walk-map]');
  await expect(map).not.toBeVisible();
  await openAtlasMap(page);
  await expect(map).toBeVisible();
  await expect(page.locator('[data-walk-map-zoom-value]')).toHaveText('100%');
  const drawing = await page.locator('[data-walk-map-viewport]').boundingBox();
  expect(drawing!.height).toBeGreaterThan(620);
  await expect(page.locator('.street-walk-map__destinations')).not.toBeVisible();
  await page.getByRole('button', { name: 'Search destinations' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search GTADB places' })).toBeVisible();
  await page.getByRole('button', { name: 'Close destinations' }).click();
  await expect(page.locator('.street-walk-map__destinations')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('map travel preserves the coordinate frame and recenters the actual arrival', async ({
  page,
}) => {
  await page.goto('/gta6-leonida-atlas/app');
  const world = page.locator('[data-walk-world]');
  await expect(world).toHaveAttribute('data-walk-ready', 'true', { timeout: 30000 });
  await openAtlasMap(page);
  const screen = await page.locator('[data-walk-map-svg]').evaluate((svg) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const point = new DOMPoint(-11111, -12345).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(screen.x, screen.y);
  await expect(world).toHaveAttribute('data-walk-map-travel-source', 'map');
  const arrival = await world.evaluate((element) => ({
    x: Number((element as HTMLElement).dataset.playerX),
    z: Number((element as HTMLElement).dataset.playerZ),
  }));
  expect(arrival.x).toBeCloseTo(-11111, 0);
  expect(arrival.z).toBeCloseTo(-12345, 0);
  await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Center map on my position' }).click();
  const pin = await page.locator('[data-walk-map-player]').boundingBox();
  expect(pin!.height).toBeGreaterThan(22);
  expect(
    Number(await page.locator('[data-walk-map]').getAttribute('data-walk-map-player-x')),
  ).toBeCloseTo(-11111, 2);
});

test('a marker drag released over chrome never continues panning on hover', async ({ page }) => {
  await page.goto('/gta6-leonida-atlas/app');
  await expect(page.locator('[data-walk-world]')).toHaveAttribute('data-walk-ready', 'true', {
    timeout: 30000,
  });
  await openAtlasMap(page);
  await page.getByRole('button', { name: 'Center map on my position' }).click();
  await expect(page.locator('[data-walk-map]')).toHaveAttribute(
    'data-walk-map-gtadb-count',
    '2198',
  );
  const point = await page.locator('[data-walk-map-svg]').evaluate((svg) => {
    const markers = [
      ...svg.querySelectorAll<SVGGraphicsElement>(
        '[data-walk-map-gtadb-supported] [data-gtadb-id]',
      ),
    ];
    for (const marker of markers) {
      const box = marker.getBoundingClientRect();
      if (box.x > 200 && box.x < 950 && box.y > 200 && box.y < 500)
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    throw new Error('No visible marker for native drag regression');
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 22, point.y + 12, { steps: 4 });
  await page.waitForTimeout(80);
  await page.mouse.move(750, 35, { steps: 4 });
  await page.mouse.up();
  const view = await page.locator('[data-walk-map-svg]').getAttribute('viewBox');
  await page.mouse.move(700, 300);
  await page.mouse.move(740, 340);
  expect(await page.locator('[data-walk-map-svg]').getAttribute('viewBox')).toBe(view);
  await expect(page.locator('[data-walk-map]')).toBeVisible();
  await expect(page.locator('[data-walk-world]')).not.toHaveAttribute(
    'data-walk-map-travel-source',
    /.+/,
  );
});

test('a landmark stand-off is disclosed and the 3D app stays fullscreen', async ({ page }) => {
  await page.goto('/gta6-leonida-atlas/app');
  const world = page.locator('[data-walk-world]');
  await expect(world).toHaveAttribute('data-walk-ready', 'true', { timeout: 30000 });
  await openAtlasMap(page);
  await page.getByRole('button', { name: 'Search destinations' }).click();
  await page.getByRole('searchbox', { name: 'Search GTADB places' }).fill('L304');
  await page.locator('[data-walk-map-search-result="L304"]').click();
  await expect(world).toHaveAttribute('data-walk-map-travel-id', 'L304');
  await expect(page.locator('[data-atlas-arrival-notice]')).toBeVisible();
  await expect(page.locator('[data-atlas-arrival-notice]')).toContainText('Arrival adjusted');
  await expect(page.locator('[data-street-shell]')).toHaveAttribute('data-walk-expanded', 'true');
  await page.getByRole('button', { name: 'Open evidence and source notes' }).click();
  await expect(page.locator('[data-walk-evidence-dialog]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-street-shell]')).toHaveAttribute('data-walk-expanded', 'true');
});
