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
    await expect(headline(page)).toContainText('fire cell-days')
  })

  test('loads real data with no login and no mock banner', async ({ page }) => {
    await expect(page.getByText('MOCK DATA, NOT REAL')).toHaveCount(0)
    await expect(selection(page)).toContainText('Mainland Italy')
    await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('NASA FIRMS')
  })

  test('a region gives the calendar, verdict with its 90% range, charts and factors', async ({ page }) => {
    await openPanel(page, 'Area')
    await page.getByRole('button', { name: /^Sicily/ }).click()
    await expect(selection(page)).toContainText('Sicily')
    await expect(page.locator('#drawer')).toContainText('cells with fire detections')
    await openPanel(page, 'Calendar')
    await expect(page.getByRole('rowheader', { name: '2003', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'More info' }).click()
    await expect(page.getByText(/percentile of \d+ Octobers/)).toBeVisible()
    await expect(page.locator('.kpis')).toContainText('90% range')
    await page.getByRole('button', { name: 'Less' }).click()
    await openPanel(page, 'Sensors')
    await expect(page.getByRole('img', { name: /yearly fire cell-days/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Conversion factors' })).toBeVisible()
    // No ground-reported source yet, so the Reported box is not offered.
    await expect(page.getByRole('button', { name: 'Reported', exact: true })).toHaveCount(0)
  })

  test('the unfinished month is compared with the same days of earlier years', async ({ page }) => {
    await page.goto('/#area=region:california&from=2026-01&to=2026-11&src=harmonized')
    await expect(headline(page)).toContainText(/1–\d+ November 2026/)
    await expect(headline(page)).toContainText('(so far)')
    await page.getByRole('button', { name: 'More info' }).click()
    await expect(page.locator('#kpi-title').locator('..')).toContainText('compared with the same days in earlier years')
  })

  test('typed coordinates: valid box works, invalid box explains why', async ({ page }) => {
    await openPanel(page, 'Area')
    await page.getByText('Or type coordinates').click()
    const field = (label: string, value: string) => page.getByLabel(label, { exact: true }).fill(value)
    await field('West', '10')
    await field('South', '38.8')
    await field('East', '8')
    await field('North', '41.3')
    await page.getByRole('button', { name: 'Use these coordinates' }).click()
    await expect(page.getByRole('alert')).toContainText('West must be less than east')
    await field('West', '7.5')
    await field('East', '10')
    await page.getByRole('button', { name: 'Use these coordinates' }).click()
    await expect(selection(page)).toContainText('Box W 7.5, S 38.8, E 10, N 41.3')
    await expect(headline(page)).toContainText('fire cell-days')
    await expect(page.locator('#drawer')).toContainText('The harmonized line is an estimate')
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
    await expect(headline(page)).toContainText('No data here')
  })

  test('drawing a circle on the globe selects an area', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Drawing is checked on desktop; phones use the region list and typed coordinates.')
    await page.waitForTimeout(2000) // let the globe finish flying to the first region
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
    await page.getByRole('button', { name: 'Enter dates manually' }).click()
    await page.getByLabel('From year').selectOption('2022')
    await page.getByLabel('From month').selectOption('1')
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
    await page.getByRole('button', { name: 'Enter dates manually' }).click()
    await page.getByLabel('From year').selectOption('2025')
    await page.getByLabel('From month').selectOption('11')
    await expect(page.locator('.range-value')).toHaveText('Nov 2025 – Oct 2026')
    await openPanel(page, 'Download')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
    const text = readFileSync((await download.path())!, 'utf8')
    expect(text).toContain('Fire cell-days count satellite detections; not fires or burned area')
    expect(text).toContain('fire_cell_days_harmonized,low_90,high_90,source')
    expect(text).not.toContain('MOCK DATA')
    expect(text.split('\n').filter((l) => /^\d{4},/.test(l))).toHaveLength(12)
  })

  test('the link restores the same view, also when pasted into an open tab', async ({ page }) => {
    await page.goto('/#area=region:california&from=2022-01&to=2024-12&src=modis')
    await expect(selection(page)).toContainText('California, Jan 2022 – Dec 2024')
    await openPanel(page, 'Layers')
    await expect(page.getByLabel('Aqua MODIS only (raw)')).toBeChecked()
  })

  test('the date bar moves by keyboard, and manual entry is one tap away', async ({ page }) => {
    await openPanel(page, 'Dates')
    await page.getByRole('slider', { name: 'Start month' }).focus()
    await page.keyboard.press('End') // start jumps to the end month
    await page.keyboard.press('PageDown') // and back one year
    await expect(selection(page)).toContainText('Oct 2025 – Oct 2026')
    await page.getByRole('button', { name: 'Enter dates manually' }).click()
    await expect(page.getByLabel('From year')).toHaveValue('2025')
  })

  test('downloads: CSV from More info and a chart image', async ({ page }) => {
    await page.getByRole('button', { name: 'More info' }).click()
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV of these months' }).click()])
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('fire_cell_days_harmonized')
    await page.getByRole('button', { name: 'Less' }).click()
    await openPanel(page, 'Trends')
    const [img] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download image (SVG)' }).first().click()])
    expect(img.suggestedFilename()).toMatch(/\.svg$/)
    expect(readFileSync((await img.path())!, 'utf8')).toContain('<svg')
  })

  test('credits live in About, not in the bottom strip', async ({ page }) => {
    await expect(page.locator('.strip')).not.toContainText('OpenStreetMap')
    await page.getByRole('button', { name: 'About' }).click()
    await expect(page.locator('#drawer')).toContainText('© OpenStreetMap contributors')
    await expect(page.locator('#drawer')).toContainText('not an official warning service')
    await expect(page.locator('#drawer')).toContainText('ISTAT')
    await expect(page.locator('#drawer')).toContainText('inside the 90% ranges')
  })

  test('the native pixel layer shows raw detections by satellite, with a key', async ({ page }) => {
    await page.goto('/#area=region:sardinia&from=2021-07&to=2021-08&src=harmonized')
    await expect(selection(page)).toContainText('Sardinia')
    await openPanel(page, 'Layers')
    const sats = page.getByLabel('Aqua MODIS (1 km pixels)')
    await expect(sats).toBeDisabled()
    await page.getByLabel('Show every detection at its real pixel size').check()
    await expect(sats).toBeEnabled()
    const key = page.locator('.legend-detections')
    await expect(key).toContainText('raw, not harmonized')
    await expect(key).toContainText(/S-NPP VIIRS \(375 m\): [1-9]/)
    await expect(page).toHaveURL(/det=1/)
    await sats.uncheck()
    await expect(key).toContainText('(hidden)')
    expect((await new AxeBuilder({ page }).exclude('.globe').analyze()).violations.map((v) => v.id)).toEqual([])
    // A link made with the layer off, pasted into this tab, turns it off.
    await page.evaluate(() => { window.location.hash = 'area=region:sardinia&from=2021-07&to=2021-08&src=harmonized' })
    await expect(key).toHaveCount(0)
    await expect(page).not.toHaveURL(/det=1/)
  })

  test('hotspots CSV: one row per detection in the search, with the FIRMS credit', async ({ page }) => {
    await page.goto('/#area=region:sardinia&from=2021-07&to=2021-07&src=harmonized')
    await expect(selection(page)).toContainText('Sardinia')
    await openPanel(page, 'Download')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download hotspots CSV' }).click()])
    expect(dl.suggestedFilename()).toBe('hotspots_sardinia_2021-07_2021-07.csv')
    const text = readFileSync((await dl.path())!, 'utf8')
    expect(text).toContain("We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS)")
    expect(text).toContain('NOT harmonized')
    // 67 Aqua + 806 S-NPP + 696 NOAA-20, checked against the source parquet with DuckDB.
    expect(text.split('\n').filter((l) => /^\d+\.\d{4},/.test(l))).toHaveLength(1569)
    await expect(page.locator('#drawer')).toContainText('Saved 1,569 hotspots.')
  })

  test('an incomplete month and drifted raw Aqua get numbers but no verdict', async ({ page }) => {
    await expect(page).toHaveTitle(/Spark 1/)
    await page.goto('/#area=region:sicily&from=2002-07&to=2002-08&src=harmonized')
    await expect(headline(page)).toContainText('incomplete month, no verdict')
    await page.goto('/#area=region:sicily&from=2022-01&to=2022-08&src=modis')
    await expect(headline(page)).toContainText('no verdict (Aqua orbit drift)')
    await page.getByRole('button', { name: 'More info' }).click()
    await expect(page.locator('.caption').first()).toContainText('Not compared with earlier years.')
    await expect(page.locator('#kpi-title').locator('..')).not.toContainText('busiest of')
  })

  test('no automatic accessibility violations', async ({ page }) => {
    const scan = async () => (await new AxeBuilder({ page }).exclude('.globe').analyze()).violations.map((v) => `${v.id}: ${v.help}`)
    expect(await scan()).toEqual([])
    await openPanel(page, 'Calendar')
    expect(await scan()).toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'More info' }).click()
    expect(await scan()).toEqual([])
    await page.getByRole('button', { name: 'Less' }).click()
    await openPanel(page, 'Dates')
    await page.getByRole('button', { name: 'Enter dates manually' }).click()
    expect(await scan()).toEqual([])
  })
})

test('the guide opens on the first visit and can be reopened', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog')).toContainText('Step 1 of')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Fire cell-days' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip guide' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(headline(page)).toContainText('fire cell-days')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Guide' }).click()
  await expect(page.getByRole('dialog')).toContainText('Step 1 of')
})
