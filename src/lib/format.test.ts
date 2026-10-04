import { describe, expect, it } from 'vitest'
import { daysBetween, shiftDays } from './format'

describe('daysBetween', () => {
  it('counts whole days across month and year ends', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9)
  })
  it('is 0 for invalid input', () => {
    expect(daysBetween('', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-1', '2026-01-01')).toBe(0)
  })
})

describe('shiftDays', () => {
  it('moves across leap days and month ends', () => {
    expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDays('2026-10-04', -4)).toBe('2026-09-30')
  })
  it('keeps a yearly renewal a year out when the sale moves', () => {
    const moved = shiftDays('2027-01-15', daysBetween('2026-01-15', '2026-02-01'))
    expect(moved).toBe('2027-02-01')
  })
})
