// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const selection = (page: Page) => page.locator('[data-tour="selection"]')
const headline = (page: Page) => page.locator('.strip-headline')
async function openPanel(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await expect(page.locator('#drawer')).toBeVisible()
}

test.describe('app', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('hotspot-calendar-guide-seen', '1'))
    await page.goto('/')
    await expect(headline(page)).toContainText('hotspots')
  })

  test('loads with no login and shows the mock banner on demo builds', async ({ page }) => {
    await expect(page.getByText('MOCK DATA, NOT REAL')).toBeVisible()
    await expect(page.getByText(/Data: NASA FIRMS/)).toBeVisible()
  })

  test('a preset gives the calendar, verdict and charts', async ({ page }) => {
    await openPanel(page, 'Area')
    await page.getByLabel('Preset region').selectOption('uk')
    await expect(selection(page)).toContainText('United Kingdom (mock)')
    await openPanel(page, 'Calendar')
    await expect(page.getByRole('rowheader', { name: '2003', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'More info' }).click()
    await expect(page.getByText(/percentile of \d+ Octobers/)).toBeVisible()
    await page.getByRole('button', { name: 'Less' }).click()
    await openPanel(page, 'Sensors')
    await expect(page.getByRole('img', { name: /yearly hotspot totals/ })).toBeVisible()
    await openPanel(page, 'Reported')
    await expect(page.getByRole('heading', { name: 'Fires detected and fires reported' })).toBeVisible()
  })

  test('typed coordinates: valid box works, invalid box explains why', async ({ page }) => {
    await openPanel(page, 'Area')
    await page.getByText('Or type coordinates').click()
    const field = (label: string, value: string) => page.getByLabel(label, { exact: true }).fill(value)
    await field('West', '5')
    await field('South', '50')
    await field('East', '1')
    await field('North', '60')
    await page.getByRole('button', { name: 'Use these coordinates' }).click()
    await expect(page.getByRole('alert')).toContainText('West must be less than east')
    await field('West', '-6')
    await page.getByRole('button', { name: 'Use these coordinates' }).click()
    await expect(selection(page)).toContainText('Box W -6, S 50, E 1, N 60')
  })

  test('an area outside the loaded data says so instead of showing zeros', async ({ page }) => {
    await openPanel(page, 'Area')
    await page.getByText('Or type coordinates').click()
    const field = (label: string, value: string) => page.getByLabel(label, { exact: true }).fill(value)
    await field('West', '-60')
    await field('South', '-10')
    await field('East', '-50')
    await field('North', '0')
    await page.getByRole('button', { name: 'Use these coordinates' }).click()
    await expect(headline(page)).toContainText('No data is loaded for this area yet')
  })

  test('drawing a circle on the globe selects an area', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Drawing is checked on desktop; phones use presets and typed coordinates.')
    await page.waitForTimeout(2000) // let the globe finish flying to the first preset
    await openPanel(page, 'Area')
    await page.getByRole('button', { name: 'Circle' }).click()
    const { width, height } = page.viewportSize()!
    const [x, y] = [width * 0.68, height * 0.45] // right of the drawer, left of the boxes
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 50, y + 30, { steps: 8 })
    await page.mouse.up()
    await expect(selection(page)).toContainText('Drawn circle')
  })

  test('changing months rescales the calendar and keyboard moves between months', async ({ page }) => {
    await openPanel(page, 'Dates')
    await page.getByRole('button', { name: 'Last 5 years' }).click()
    await openPanel(page, 'Calendar')
    await expect(page.getByText(/bins fit Jan 2022 to Oct 2026/)).toBeVisible()
    await page.mouse.move(0, 0) // hover also updates the detail line; keep the pointer out of the way
    await page.getByLabel(/^Oct 2026:/).focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByLabel(/^Oct 2025:/)).toBeFocused()
    await expect(page.locator('.cell-detail')).toContainText('Oct 2025')
  })

  test('CSV download has provenance and one row per month', async ({ page }) => {
    await openPanel(page, 'Dates')
    await page.getByRole('button', { name: 'Last 12 months' }).click()
    await openPanel(page, 'Download')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
    const text = readFileSync((await download.path())!, 'utf8')
    expect(text).toContain('# Counts are satellite hotspot detections, not fires or burned area.')
    expect(text).toContain('MOCK DATA, NOT REAL')
    expect(text.split('\n').filter((l) => /^\d{4},/.test(l))).toHaveLength(12)
  })

  test('the link restores the same view, also when pasted into an open tab', async ({ page }) => {
    await page.goto('/#area=preset:uk&from=2022-01&to=2024-12&src=modis')
    await expect(selection(page)).toContainText('United Kingdom (mock), Jan 2022 – Dec 2024')
    await openPanel(page, 'Layers')
    await expect(page.getByLabel('MODIS only (raw)')).toBeChecked()
  })

  test('no automatic accessibility violations', async ({ page }) => {
    const scan = async () => (await new AxeBuilder({ page }).exclude('.globe').analyze()).violations.map((v) => `${v.id}: ${v.help}`)
    expect(await scan()).toEqual([])
    await openPanel(page, 'Calendar')
    expect(await scan()).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'More info' }).click()
    expect(await scan()).toEqual([])
  })
})

test('the guide opens on the first visit and can be reopened', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Step 1 of')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Area' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip guide' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(headline(page)).toContainText('hotspots')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Guide' }).click()
  await expect(page.getByRole('dialog')).toContainText('Step 1 of')
})
