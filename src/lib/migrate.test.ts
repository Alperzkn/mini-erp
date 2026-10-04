import { describe, expect, it } from 'vitest'
import { normalize } from './migrate'

describe('normalize v2 → v3', () => {
  it('turns a person-with-company into a company with a primary contact', () => {
    const db = normalize({
      version: 2,
      settings: { salePrefix: 'INV-', nextSaleNumber: 9 },
      customers: [{ id: 'c1', name: 'Ada', company: 'Acme', email: 'ada@acme.io', createdAt: 'x' }],
    })
    const c = db.customers[0]
    expect(c.name).toBe('Acme')
    expect(c.email).toBeUndefined()
    expect(c.contacts).toHaveLength(1)
    expect(c.contacts[0]).toMatchObject({ name: 'Ada', email: 'ada@acme.io', primary: true })
    expect(c.contacts[0].phone).toBeUndefined()
    expect('phone' in c.contacts[0]).toBe(false)
    expect(db.settings.saleNumberFormat).toBe('INV-{####}')
    expect((db.settings as unknown as Record<string, unknown>).nextSaleNumber).toBeUndefined()
    expect((db.settings as unknown as Record<string, unknown>).salePrefix).toBeUndefined()
  })

  it('turns a person without company into a company named after them', () => {
    const db = normalize({ customers: [{ id: 'c1', name: 'Bob', phone: '1', createdAt: 'x' }] })
    const c = db.customers[0]
    expect(c.name).toBe('Bob')
    expect(c.phone).toBe('1')
    expect(c.contacts[0]).toMatchObject({ name: 'Bob', phone: '1', primary: true })
  })

  it('keeps v3 customers untouched and defaults the format', () => {
    const v3 = {
      version: 3,
      customers: [{ id: 'c', name: 'Z', contacts: [{ id: 'p', name: 'P', createdAt: 'x' }], createdAt: 'x' }],
    }
    const db = normalize(v3)
    expect(db.customers[0].contacts).toEqual(v3.customers[0].contacts)
    expect(db.settings.saleNumberFormat).toBe('S-{YYYY}-{####}')
    expect(db.version).toBe(3)
  })

  it('drops the untouched default prefix when there are no sales yet', () => {
    const db = normalize({ version: 2, settings: { salePrefix: 'S-', nextSaleNumber: 1 }, sales: [] })
    expect(db.settings.saleNumberFormat).toBe('S-{YYYY}-{####}')
  })

  it('keeps the default prefix when sales already use it', () => {
    const db = normalize({
      version: 2,
      settings: { salePrefix: 'S-', nextSaleNumber: 2 },
      sales: [{ id: 's', number: 'S-0001', customerId: 'c', date: '2026-01-01', items: [], discount: 0, status: 'paid' }],
    })
    expect(db.settings.saleNumberFormat).toBe('S-{####}')
  })

  it('adds an empty sales team and passes an existing one through', () => {
    expect(normalize({}).salespeople).toEqual([])
    const reps = [{ id: 'r', name: 'R', active: true, createdAt: 'x' }]
    expect(normalize({ version: 3, salespeople: reps }).salespeople).toEqual(reps)
  })

  it('returns an empty db for null', () => {
    expect(normalize(null).customers).toEqual([])
  })
})
