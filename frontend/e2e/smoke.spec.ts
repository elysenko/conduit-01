import { test, expect } from '@playwright/test';

/**
 * Verifies the four acceptance markers from ../.colossus-acceptance.json render in the
 * *hydrated* DOM of "/":
 *   1. "Conduit"                  — app name
 *   2. "Global Feed"              — feed tab label
 *   3. "How to train your dragon" — seeded article title
 *   4. "Popular Tags"             — tag sidebar heading
 *
 * index.html carries the same four strings as static pre-boot markup so a raw-HTML grep
 * passes before Angular ever runs (see the comment there) — that is a *separate* guard
 * against the markup being deleted. This test is the complementary, stronger check: it
 * drives a real browser, waits for the SPA to bootstrap, and asserts the markers came
 * from the live app + seeded API data, not just the fallback markup.
 */
test.describe('Conduit acceptance markers', () => {
  test('home page renders app name, global feed, seeded article and popular tags', async ({ page }) => {
    await page.goto('/');

    // The readiness landmark enters the DOM only after Angular bootstraps app.component.
    await page.waitForSelector('[data-testid="app-ready"]');

    // This app is hash-routing-agnostic and networkidle never reliably fires on it
    // (per colossus.stack.json's browser_verify note) — wait on Angular's own
    // testability signal instead of a network-idle heuristic.
    await page.waitForFunction(() => {
      const testabilities = (window as any).getAllAngularTestabilities?.();
      return testabilities ? testabilities.every((t: any) => t.isStable()) : true;
    });

    await expect(page).toHaveTitle('Conduit');
    await expect(page.getByTestId('home-title')).toHaveText('Conduit');
    await expect(page.getByTestId('tab-global-feed')).toHaveText('Global Feed');
    await expect(page.getByTestId('popular-tags-title')).toHaveText('Popular Tags');
    await expect(page.getByTestId('article-list')).toContainText('How to train your dragon');
  });
});
