// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
// Layout and visual-accessibility checks: short screens, zoom, calendar fit, map credit contrast, forced colours.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ context, page }) => {
  // Never load the real tile hosts from tests; the globe stays black and every control still works.
  await context.route((u) => u.hostname !== 'localhost', (r) => r.abort())
  await page.addInitScript(() => localStorage.setItem('hotspot-calendar-guide-seen', '1'))
})

interface Vp { width: number; height: number }

async function load(page: Page, vp: Vp, hash = '/') {
  await page.setViewportSize(vp)
  await page.goto(hash)
  await expect(page.locator('.strip-headline')).toContainText('fire cell-days')
}
async function settleStrip(page: Page) {
  await page.waitForFunction(() => {
    const w = document.querySelector('.strip-more-wrap') as HTMLElement | null
    const el = w?.firstElementChild as HTMLElement | undefined
    return !!w && !!el && (w.dataset.open === 'true' ? el.getBoundingClientRect().height > 20 : el.getBoundingClientRect().height === 0)
  })
  await page.waitForTimeout(450) // grid-template-rows transition has no cheap completion signal
}
async function openDrawer(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click()
  await page.waitForFunction(() => {
    const d = document.querySelector('#drawer') as HTMLElement | null
    if (!d) return false
    const cs = getComputedStyle(d)
    return cs.opacity === '1' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)')
  })
}
const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

/** For every feature box: is it on screen, and is the element at its centre the box itself (nothing covers it)? */
function boxesClickable(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.box')].map((b) => {
    const r = b.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { label: b.textContent, onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, ok: !!hit && b.contains(hit) }
  }))
}

const SHORT: Vp[] = [{ width: 844, height: 390 }, { width: 740, height: 360 }, { width: 915, height: 412 }, { width: 640, height: 360 }, { width: 320, height: 256 }]

test.describe('short screens and zoom', () => {
  for (const vp of SHORT) {
    for (const expanded of [false, true]) {
      test(`feature boxes visible and clickable at ${vp.width}x${vp.height}, strip ${expanded ? 'expanded' : 'collapsed'}`, async ({ page }) => {
        await load(page, vp)
        if (expanded) { await page.getByRole('button', { name: 'More info' }).click(); await settleStrip(page) }
        const boxes = await boxesClickable(page)
        expect(boxes.length).toBeGreaterThanOrEqual(7)
        for (const b of boxes) expect(b, b.label ?? '').toMatchObject({ onScreen: true, ok: true })
        expect(await noPageScroll(page)).toBe(true)
        // The top bar never overlaps a rail.
        const overlap = await page.evaluate(() => {
          const t = document.querySelector('.topbar')!.getBoundingClientRect()
          return [...document.querySelectorAll('.rail')].some((r) => r.getBoundingClientRect().top < t.bottom - 1)
        })
        expect(overlap).toBe(false)
      })
    }
  }

  test('an open drawer has a usable body at 844x390 and 740x360', async ({ page }) => {
    for (const vp of [{ width: 844, height: 390 }, { width: 740, height: 360 }]) {
      await load(page, vp)
      for (const name of ['Layers', 'Calendar']) {
        await openDrawer(page, name)
        const h = await page.locator('#drawer .drawer-body').evaluate((e) => e.getBoundingClientRect().height)
        expect(h, `${name} body at ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(150)
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.querySelector('#drawer'))
      }
    }
  })

  test('browser zoom 200% (640x360) and 400% (320x256): a drawer opens from its box', async ({ page }) => {
    for (const vp of [{ width: 640, height: 360 }, { width: 320, height: 256 }]) {
      await load(page, vp)
      await page.getByRole('button', { name: 'Area', exact: true }).click()
      await expect(page.locator('#drawer')).toBeVisible()
      await page.keyboard.press('Escape')
    }
  })

  test('root font size at 200% on 1280x720 keeps the boxes clear of the top bar and their labels whole', async ({ page }) => {
    await page.addInitScript(() => { document.documentElement.style.fontSize = '200%' })
    await load(page, { width: 1280, height: 720 })
    const res = await page.evaluate(() => {
      const t = document.querySelector('.topbar')!.getBoundingClientRect()
      const rails = [...document.querySelectorAll<HTMLElement>('.rail')]
      const clipped = [...document.querySelectorAll<HTMLElement>('.box')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent)
      return { railTop: Math.min(...rails.map((r) => r.getBoundingClientRect().top)), topBottom: t.bottom, clipped }
    })
    expect(res.railTop).toBeGreaterThanOrEqual(res.topBottom)
    expect(res.clipped).toEqual([])
    for (const b of await boxesClickable(page)) expect(b, b.label ?? '').toMatchObject({ onScreen: true, ok: true })
  })
})

test.describe('burning calendar', () => {
  for (const vp of [{ width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1360, height: 900 }]) {
    test(`all 12 months and the totals fit without scrolling at ${vp.width}x${vp.height}`, async ({ page }) => {
      await load(page, vp)
      await openDrawer(page, 'Calendar')
      const m = await page.evaluate(() => {
        const w = document.querySelector<HTMLElement>('.calendar-wrap')!
        const t = document.querySelector('table.calendar td.total')!.getBoundingClientRect()
        return { scroll: w.scrollWidth, client: w.clientWidth, cols: document.querySelectorAll('table.calendar thead th').length, totalRight: t.right, wrapRight: w.getBoundingClientRect().right }
      })
      expect(m.cols).toBe(14) // year + 12 months + total
      expect(m.scroll).toBeLessThanOrEqual(m.client)
      expect(m.totalRight).toBeLessThanOrEqual(m.wrapRight + 0.5)
      // Also with the numbers shown in the cells.
      await page.getByLabel('Show numbers in cells (table view)').check()
      expect(await page.evaluate(() => { const w = document.querySelector<HTMLElement>('.calendar-wrap')!; return w.scrollWidth <= w.clientWidth })).toBe(true)
      expect(await noPageScroll(page)).toBe(true)
    })
  }

  test('on a phone the sideways scroll is cued', async ({ page }) => {
    await load(page, { width: 390, height: 844 })
    await openDrawer(page, 'Calendar')
    await expect(page.locator('.scroll-hint')).toBeVisible()
    expect(await noPageScroll(page)).toBe(true)
  })
})

function luminance([r, g, b]: number[]) {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

test.describe('map credit', () => {
  for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    test(`attribution text and links reach 4.5:1 collapsed and expanded at ${vp.width}x${vp.height}`, async ({ page }) => {
      await load(page, vp)
      await expect(page.locator('.maplibregl-ctrl-attrib-inner')).toContainText('NASA FIRMS')
      const measure = () => page.evaluate(() => {
        const attrib = document.querySelector<HTMLElement>('.maplibregl-ctrl-attrib')!
        // With the tile hosts blocked the style never loads and the credit has no links; add one to measure the link colour.
        const inner = attrib.querySelector('.maplibregl-ctrl-attrib-inner')!
        if (!inner.querySelector('a')) inner.insertAdjacentHTML('beforeend', ' <a href="#probe">probe</a>')
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
        // The glass flattened onto the black globe (tiles are blocked in tests). It is 86% opaque, so real tiles barely change it.
        const bg = parse(getComputedStyle(attrib).backgroundColor)
        const a = bg.length > 3 ? bg[3] : 1
        const flat = bg.slice(0, 3).map((c) => c * a)
        const colours = [attrib, ...attrib.querySelectorAll<HTMLElement>('.maplibregl-ctrl-attrib-inner, a')].map((e) => parse(getComputedStyle(e).color).slice(0, 3))
        return { flat, colours, links: attrib.querySelectorAll('a').length }
      })
      const check = async (state: string) => {
        const m = await measure()
        expect(m.links).toBeGreaterThan(0)
        const bl = luminance(m.flat)
        for (const c of m.colours) {
          const l = luminance(c)
          expect((Math.max(l, bl) + 0.05) / (Math.min(l, bl) + 0.05), `${state} ${c}`).toBeGreaterThanOrEqual(4.5)
        }
      }
      // MapLibre opens the credit by default on wide maps and collapses it on narrow ones: measure both states.
      const isOpen = () => page.locator('.maplibregl-ctrl-attrib').evaluate((e) => (e as HTMLDetailsElement).open)
      const first = await isOpen()
      await check(first ? 'expanded' : 'collapsed')
      await page.locator('.maplibregl-ctrl-attrib-button').click()
      await expect.poll(isOpen).toBe(!first)
      await check(first ? 'collapsed' : 'expanded')
      if (first) { await page.locator('.maplibregl-ctrl-attrib-button').click(); await expect.poll(isOpen).toBe(true); await check('expanded') }
      // The "i" toggle stays visible on the dark glass (its black icon is inverted to white).
      expect(await page.locator('.maplibregl-ctrl-attrib-button').evaluate((e) => getComputedStyle(e).filter)).toContain('invert')
    })
  }
})

test.describe('forced colours', () => {
  test('calendar cells, legend swatches and the month slider keep their colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await load(page, { width: 1366, height: 768 })
    await openDrawer(page, 'Calendar')
    const cells = await page.evaluate(() => {
      const cs = [...document.querySelectorAll<HTMLElement>('table.calendar tbody td.c:not(.nodata):not(.outside)')]
      return { colours: new Set(cs.map((c) => getComputedStyle(c).backgroundColor)).size, adjust: getComputedStyle(cs[0]).forcedColorAdjust, border: getComputedStyle(cs[0]).borderTopWidth }
    })
    expect(cells.colours).toBeGreaterThan(2)
    expect(cells.adjust).toBe('none')
    expect(parseFloat(cells.border)).toBeGreaterThan(0)
    const swatches = await page.evaluate(() => {
      const sw = [...document.querySelectorAll<HTMLElement>('.legend .swatch')]
      return { n: sw.length, colours: new Set(sw.map((s) => getComputedStyle(s).backgroundColor)).size, adjust: sw.every((s) => getComputedStyle(s).forcedColorAdjust === 'none') }
    })
    expect(swatches.n).toBeGreaterThan(2)
    expect(swatches.colours).toBeGreaterThan(2)
    expect(swatches.adjust).toBe(true)
    await page.keyboard.press('Escape')
    await openDrawer(page, 'Dates')
    expect(await page.locator('.range-track').evaluate((e) => getComputedStyle(e).forcedColorAdjust)).toBe('none')
  })
})

test.describe('map controls', () => {
  const covered = (page: Page) => page.evaluate(() => ['.maplibregl-ctrl-zoom-in', '.maplibregl-ctrl-zoom-out', '.maplibregl-ctrl-attrib-button'].map((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { sel, ok: !!hit && el.contains(hit) }
  }))

  test('zoom control and credit stay uncovered when More info is expanded', async ({ page }) => {
    for (const vp of [{ width: 1366, height: 768 }, { width: 1360, height: 900 }, { width: 1024, height: 768 }]) {
      await load(page, vp)
      await page.getByRole('button', { name: 'More info' }).click()
      await settleStrip(page)
      for (const c of await covered(page)) expect(c, `${vp.width}x${vp.height} ${c.sel}`).toMatchObject({ ok: true })
      expect(await noPageScroll(page)).toBe(true)
    }
  })

  test('zoom control and credit stay clickable with a drawer open on a phone and in landscape', async ({ page }) => {
    for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await load(page, vp)
      await openDrawer(page, 'Layers')
      for (const c of await covered(page)) expect(c, `${vp.width}x${vp.height} ${c.sel}`).toMatchObject({ ok: true })
    }
  })
})

test.describe('targets and overlaps', () => {
  test('month slider thumbs are at least 24px wide and the tick labels do not overlap', async ({ page }) => {
    for (const vp of [{ width: 1366, height: 768 }, { width: 320, height: 568 }]) {
      await load(page, vp)
      await openDrawer(page, 'Dates')
      const m = await page.evaluate(() => {
        const thumbs = [...document.querySelectorAll<HTMLElement>('.range-thumb')].map((t) => t.getBoundingClientRect().width)
        const ticks = [...document.querySelectorAll<HTMLElement>('.range-ticks span')].map((t) => t.getBoundingClientRect())
        return { thumbs, overlaps: ticks.some((a, i) => ticks.some((b, j) => j > i && a.left < b.right && b.left < a.right)) }
      })
      for (const w of m.thumbs) expect(w).toBeGreaterThanOrEqual(24)
      expect(m.overlaps, `${vp.width}x${vp.height}`).toBe(false)
    }
  })

  test('"Or type coordinates" summary is at least 24px tall', async ({ page }) => {
    await load(page, { width: 390, height: 844 })
    await openDrawer(page, 'Area')
    const h = await page.getByText('Or type coordinates').evaluate((e) => e.getBoundingClientRect().height)
    expect(h).toBeGreaterThanOrEqual(24)
  })
})
