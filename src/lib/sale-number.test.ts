import { describe, expect, it } from 'vitest'
import { isSaleNumberTaken, nextSaleNumber, renderParts, validateFormat } from './sale-number'

const d = '2026-10-04'

describe('renderParts', () => {
  it('substitutes date tokens and finds the sequence run', () => {
    expect(renderParts('S-{YYYY}{MM}-{###}', d)).toEqual({ prefix: 'S-202610-', suffix: '', width: 3 })
    expect(renderParts('{YY}/{DD}-{##}-X', d)).toEqual({ prefix: '26/04-', suffix: '-X', width: 2 })
  })
  it('appends a 4-wide run when the format has none', () => {
    expect(renderParts('INV-{YYYY}', d)).toEqual({ prefix: 'INV-2026', suffix: '', width: 4 })
  })
  it('falls back to today for a malformed date', () => {
    const y = String(new Date().getFullYear())
    expect(renderParts('{YYYY}-{##}', '2026-13-40').prefix).toBe(`${y}-`)
    expect(renderParts('{YYYY}-{##}', '').prefix).toBe(`${y}-`)
  })
})

describe('nextSaleNumber', () => {
  it('starts at 1 and increments past the highest existing', () => {
    expect(nextSaleNumber('S-{YYYY}-{####}', d, [])).toBe('S-2026-0001')
    const sales = [{ number: 'S-2026-0007' }, { number: 'S-2026-0003' }, { number: 'S-2025-0100' }]
    expect(nextSaleNumber('S-{YYYY}-{####}', d, sales)).toBe('S-2026-0008')
  })
  it('restarts per period and ignores numbers from other prefixes', () => {
    const sales = [{ number: 'S-202609-005' }, { number: 'junk' }]
    expect(nextSaleNumber('S-{YYYY}{MM}-{###}', d, sales)).toBe('S-202610-001')
  })
  it('does not overflow the width', () => {
    expect(nextSaleNumber('{##}', d, [{ number: '99' }])).toBe('100')
  })
  it('treats regex characters in the format literally', () => {
    expect(nextSaleNumber('A.B({YY})-{##}', d, [{ number: 'A.B(26)-04' }])).toBe('A.B(26)-05')
  })
})

describe('isSaleNumberTaken', () => {
  const sales = [
    { id: 'a', number: 'S-1' },
    { id: 'b', number: 'S-2' },
  ]
  it('ignores the excluded sale and surrounding spaces', () => {
    expect(isSaleNumberTaken('S-1', sales)).toBe(true)
    expect(isSaleNumberTaken('S-1', sales, 'a')).toBe(false)
    expect(isSaleNumberTaken(' S-2 ', sales)).toBe(true)
  })
})

describe('validateFormat', () => {
  it('rejects two sequence runs and empty formats', () => {
    expect(validateFormat('S-{YYYY}-{####}')).toBeNull()
    expect(validateFormat('{##}-{##}')).toMatch(/one/i)
    expect(validateFormat('   ')).toMatch(/empty/i)
  })
})
