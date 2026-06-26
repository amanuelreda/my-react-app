import { test, expect } from '@playwright/test';

// Verifies the Groups / Forums / Discover sections render REAL state derived from the indexer
// reducer (running in-browser over seed events), not mock data — including reputation-weighted
// thread ranking and on-chain roles.
test('forums rank threads by reputation-weighted score', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  await page.locator('.rail button', { hasText: '🗂️' }).click();
  const scores = page.getByTestId('thread-score');
  await expect(scores.first()).toBeVisible();

  const values = (await scores.allTextContents()).map((t) => Number(t));
  expect(values.length).toBeGreaterThanOrEqual(2);
  // "Hot" sort: scores are non-increasing, and the top thread (weighted 7+4=11) outranks the
  // single weight-3 upvote thread.
  const sorted = [...values].sort((a, b) => b - a);
  expect(values).toEqual(sorted);
  expect(values[0]).toBe(11);

  // Expanding a thread shows its nested replies (parentId threading from the indexer).
  await page.getByTestId('thread').first().click();
  // The top thread (post 11) has no replies; open the one that does (post 10).
});

test('forums: nested replies render for a thread that has them', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  // Switch to "New" so ordering is by id; post 10 (with 2 replies) is present regardless.
  const threadWithReplies = page.getByTestId('thread').filter({ hasText: 'MLS vs Sender Keys for large' });
  await threadWithReplies.click();
  await expect(page.getByTestId('replies').first()).toBeVisible();
});

test('groups show on-chain roster with roles', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  await page.locator('.rail button', { hasText: '👥' }).click();
  const members = page.getByTestId('group-members');
  await expect(members).toBeVisible();
  // Owner + promoted admin + member are derived from GroupCreated/MemberJoined/RoleChanged events.
  await expect(members.getByText('owner')).toBeVisible();
  await expect(members.getByText('admin')).toBeVisible();

  await page.screenshot({ path: 'e2e/sections.png', fullPage: false });
});

test('discover ranks users by reputation', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  await page.locator('.rail button', { hasText: '🧭' }).click();
  const users = page.getByTestId('top-users');
  await expect(users).toBeVisible();
  // bob has reputation 110, alice 40 -> bob ranks first.
  const first = users.locator('.row').first();
  await expect(first).toContainText('bob');
});
