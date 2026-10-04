import { describe, expect, it } from 'vitest'
import { cheapestLicense, daysBetween, renewalOf, shiftDays } from './format'
import type { Sale } from './types'

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

describe('shiftDays on bad input', () => {
  it('returns the input unchanged when it is not a full date', () => {
    expect(shiftDays('2026-1', 5)).toBe('2026-1')
    expect(shiftDays('', 5)).toBe('')
  })
})

describe('renewalOf', () => {
  const sale: Sale = {
    id: 's1',
    number: 'S-1',
    customerId: 'c1',
    date: '2026-01-01',
    currency: 'USD',
    items: [],
    discount: 0,
    status: 'paid',
    renewalDate: '2027-01-01',
    events: [],
    createdAt: 'x',
    updatedAt: 'x',
  }
  it('leaves out rep and contact keys when the sale has none, so prefill can supply them', () => {
    const r = renewalOf(sale)
    expect('salespersonId' in r).toBe(false)
    expect('contactId' in r).toBe(false)
  })
  it('carries them over when set', () => {
    expect(renewalOf({ ...sale, contactId: 'p', salespersonId: 'r' })).toMatchObject({
      contactId: 'p',
      salespersonId: 'r',
    })
  })
})

describe('cheapestLicense', () => {
  const settings = { businessName: '', baseCurrency: 'USD', rates: { USD: 1, TRY: 40 }, saleNumberFormat: 'S-{####}' }
  const lic = (name: string, price: number, currency: string, active = true) => ({
    id: name,
    name,
    price,
    currency,
    billing: 'yearly' as const,
    active,
    createdAt: 'x',
  })
  it('compares across currencies and ignores inactive licenses', () => {
    const cheapest = cheapestLicense(
      [lic('Pro', 900, 'TRY'), lic('Ent', 500, 'USD'), lic('Old', 1, 'USD', false)],
      settings,
    )
    expect(cheapest?.name).toBe('Pro')
  })
  it('is undefined with no active licenses', () => {
    expect(cheapestLicense([lic('Old', 1, 'USD', false)], settings)).toBeUndefined()
  })
})
