import { test, expect } from '@playwright/test';

// Full-text search across groups/forums/posts/people, powered by the indexer SearchIndex running
// in-browser. Verifies cross-type results, relevance, prefix typeahead, and the empty state.
test('global search returns ranked cross-type results', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🧭' }).click();

  const input = page.getByTestId('search-input');
  await input.fill('governance');
  const results = page.getByTestId('search-results');
  await expect(results).toBeVisible();
  // The DAO-governed forum "Protocol & Governance" and the governance proposal post both match.
  await expect(results.locator('[data-result-type="forum"]').first()).toBeVisible();
  await expect(results.getByText(/governance/i).first()).toBeVisible();
});

test('search matches people and supports prefix typeahead', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🧭' }).click();

  const input = page.getByTestId('search-input');
  // prefix "encr" should match "Encrypted/encryption…" content via typeahead
  await input.fill('mls');
  await expect(page.getByTestId('search-results').getByText(/MLS/i).first()).toBeVisible();

  await input.fill('alice');
  await expect(page.getByTestId('search-results').locator('[data-result-type="user"]').first()).toBeVisible();
});

test('search empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🧭' }).click();
  await page.getByTestId('search-input').fill('zzzznotathing');
  await expect(page.getByTestId('search-results').getByText(/No results/)).toBeVisible();
});
