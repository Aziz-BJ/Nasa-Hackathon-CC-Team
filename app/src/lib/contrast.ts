// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.

/** White or black text, whichever contrasts more with the cell (WCAG luminance). Always at least 4.58:1. */
export function textClass(hex: string): 'dark-text' | 'light-text' {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return 'light-text'
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? 'dark-text' : 'light-text'
}
