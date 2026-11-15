// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Regressions found by the independent review of the stress-test fixes.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context, page }) => {
  // Map tiles come from third parties: never load them in tests.
  await context.route((u) => u.hostname !== 'localhost', (r) => r.abort())
})

const VIEW = '#area=region:sicily&from=2015-01&to=2024-10&src=modis&pal=cividis'

test('the skip link keeps the view in the address bar', async ({ page }) => {
  await page.goto('/' + VIEW)
  await expect(page.locator('.strip-headline')).toContainText('October 2024')
  await page.evaluate(() => { location.hash = '#main' })
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(VIEW)
  await page.reload()
  await expect(page.locator('[data-tour="selection"]')).toContainText('Sicily')
  await expect(page.locator('[data-tour="selection"]')).toContainText('Jan 2015')
})

test('a refused link keeps the current view and puts its link back', async ({ page }) => {
  await page.goto('/' + VIEW)
  await expect(page.locator('.strip-headline')).toContainText('October 2024')
  await page.evaluate(() => { location.hash = '#area=box:-180,-90,180,90' })
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(VIEW)
  await expect(page.locator('[data-tour="selection"]')).toContainText('Sicily')
})
