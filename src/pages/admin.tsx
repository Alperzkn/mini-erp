import { useEffect, useRef, useState } from 'react'
import { DownloadIcon, FolderIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { PageHeader } from '@/components/page-header'
import { CSV_EXPORTS } from '@/lib/csv'
import { download } from '@/lib/download'
import { pairRate, today } from '@/lib/format'
import { nextSaleNumber, validateFormat } from '@/lib/sale-number'
import { getStorage, setStorage, type StorageInfo, type StorageMode } from '@/lib/storage'
import { useStore } from '@/lib/store'
import type { Currency, Db, Rates } from '@/lib/types'

function fmt(n: number): string {
  return String(Number(n.toPrecision(6)))
}

function isCurrencyCode(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency: code })
    return true
  } catch {
    return false
  }
}

/** "1 EUR = x USD" and "1 USD = y EUR", both editable and kept in sync. */
function RateRow({
  currency,
  base,
  rates,
  onChange,
  onRemove,
}: {
  currency: Currency
  base: Currency
  rates: Rates
  onChange: (value: number) => void
  onRemove?: () => void
}) {
  const [fwd, setFwd] = useState(() => fmt(pairRate(currency, base, rates)))
  const [inv, setInv] = useState(() => fmt(pairRate(base, currency, rates)))

  const update = (raw: string, inverse: boolean) => {
    const n = Number(raw)
    if (inverse) setInv(raw)
    else setFwd(raw)
    if (!(n > 0)) return
    const toBase = inverse ? 1 / n : n
    if (inverse) setFwd(fmt(toBase))
    else setInv(fmt(1 / toBase))
    onChange(toBase)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
      <div className="w-12 font-mono font-medium">{currency}</div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">1 {currency} =</span>
        <Input
          type="number"
          min="0"
          step="any"
          className="h-8 w-32 text-right"
          value={fwd}
          onFocus={(e) => e.target.select()}
          onChange={(e) => update(e.target.value, false)}
          aria-invalid={!(Number(fwd) > 0)}
        />
        <span className="text-muted-foreground">{base}</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground whitespace-nowrap">1 {base} =</span>
        <Input
          type="number"
          min="0"
          step="any"
          className="h-8 w-32 text-right"
          value={inv}
          onFocus={(e) => e.target.select()}
          onChange={(e) => update(e.target.value, true)}
          aria-invalid={!(Number(inv) > 0)}
        />
        <span className="text-muted-foreground">{currency}</span>
      </label>
      {onRemove && (
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Remove ${currency}`} onClick={onRemove}>
          <Trash2Icon />
        </Button>
      )}
    </div>
  )
}

function CurrenciesCard() {
  const { db, updateSettings } = useStore()
  const { settings } = db
  const [base, setBase] = useState(settings.baseCurrency)
  const [rates, setRates] = useState<Rates>(settings.rates)
  const [newCode, setNewCode] = useState('')
  const used = new Set([
    ...db.sales.map((s) => s.currency),
    ...db.products.map((p) => p.currency),
    ...db.customers.map((c) => c.currency).filter(Boolean),
  ])

  const codes = Object.keys(rates)
  const dirty = base !== settings.baseCurrency || JSON.stringify(rates) !== JSON.stringify(settings.rates)

  const setToBase = (c: Currency, toBase: number) => setRates((r) => ({ ...r, [c]: r[base] / toBase }))

  const add = () => {
    const code = newCode.trim().toUpperCase()
    if (!isCurrencyCode(code)) {
      toast.error(`"${code}" is not a valid 3-letter currency code`)
      return
    }
    if (rates[code]) {
      toast.error(`${code} is already in the list`)
      return
    }
    setRates((r) => ({ ...r, [code]: r[base] }))
    setNewCode('')
  }

  const remove = (c: Currency) => {
    if (used.has(c)) {
      toast.error(`${c} is used by sales, products or customers, so it can't be removed`)
      return
    }
    setRates((r) => {
      const next = { ...r }
      delete next[c]
      return next
    })
  }

  const save = () => {
    updateSettings({ baseCurrency: base, rates, ratesUpdatedAt: new Date().toISOString() })
    toast.success('Exchange rates saved')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currencies & exchange rates</CardTitle>
        <CardDescription>
          Every sale keeps its own currency. Dashboards and reports convert to the reporting currency. New sales save
          the rates of the day, so changing rates here never changes past sales.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Reporting currency" className="max-w-56">
          <Select value={base} onValueChange={(v) => v && setBase(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {codes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="divide-y border-y">
          {codes
            .filter((c) => c !== base)
            .map((c) => (
              <RateRow
                // Re-create rows when the reporting currency changes so they show the new pair.
                key={`${c}-${base}`}
                currency={c}
                base={base}
                rates={rates}
                onChange={(v) => setToBase(c, v)}
                onRemove={() => remove(c)}
              />
            ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-9 w-28 font-mono uppercase"
            placeholder="GBP"
            maxLength={3}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            aria-label="New currency code"
          />
          <Button variant="outline" size="sm" onClick={add}>
            <PlusIcon /> Add currency
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={!dirty}>
          Save rates
        </Button>
        <span className="text-muted-foreground text-xs">
          {settings.ratesUpdatedAt
            ? `Last updated ${new Date(settings.ratesUpdatedAt).toLocaleString()}`
            : 'Rates are placeholders until you save them.'}
        </span>
      </CardFooter>
    </Card>
  )
}

function DataLocationCard({ onChanged }: { onChanged: () => void }) {
  const { reload } = useStore()
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [loadError, setLoadError] = useState<string>()
  const [target, setTarget] = useState('')
  const [pending, setPending] = useState<StorageMode | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getStorage()
      .then(setInfo)
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  const locked = info?.source === 'env'
  const path = target.trim()

  const apply = async (mode: StorageMode) => {
    setBusy(true)
    try {
      const next = await setStorage(path, mode)
      setInfo(next)
      setTarget('')
      await reload()
      onChanged()
      toast.success(`Now using ${next.dataDir}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      setPending(undefined)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data location</CardTitle>
        <CardDescription>
          The folder that holds <code className="bg-muted rounded px-1">db.json</code>, backups and CSV copies. Point it
          at a synced folder to keep your data off this machine too.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="bg-muted/40 flex items-start gap-3 rounded-lg border px-3 py-2.5">
          <FolderIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 text-sm">
            <div className="font-mono break-all">{info?.dataDir ?? (loadError ? 'Unavailable' : 'Loading…')}</div>
            <div className="text-muted-foreground text-xs">
              {loadError
                ? `Could not read the setting: ${loadError}`
                : info?.source === 'env'
                  ? 'Set by the MINI_ERP_DATA_DIR environment variable. Unset it to change the folder here.'
                  : info?.source === 'config'
                    ? 'Chosen here in Admin. Saved in ~/.config/mini-erp/config.json.'
                    : 'The default folder next to the app.'}
            </div>
          </div>
        </div>
        <Field
          label="New folder"
          htmlFor="ad-folder"
          hint="An absolute path, or one starting with ~ for your home folder. It is created if it doesn't exist."
        >
          <Input
            id="ad-folder"
            className="font-mono"
            placeholder="~/Dropbox/mini-erp"
            disabled={locked || !info}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={locked || !path || busy} onClick={() => setPending('move')}>
            Move data here
          </Button>
          <Button variant="outline" disabled={locked || !path || busy} onClick={() => setPending('use')}>
            Use this folder
          </Button>
        </div>
      </CardContent>
      <ConfirmDialog
        open={pending === 'move'}
        onOpenChange={(o) => !o && setPending(undefined)}
        title="Move your data?"
        description={`Copies your database, backups and CSV files to ${path} and switches to it. The current folder is left untouched.`}
        confirmLabel="Move data"
        onConfirm={() => void apply('move')}
      />
      <ConfirmDialog
        open={pending === 'use'}
        onOpenChange={(o) => !o && setPending(undefined)}
        title="Switch folder?"
        description={`Switches to ${path}. If it has no database yet you start empty; your current data stays where it is.`}
        confirmLabel="Switch"
        onConfirm={() => void apply('use')}
      />
    </Card>
  )
}

export function AdminPage() {
  // Bumped after a restore so every form re-reads the restored settings.
  const [version, setVersion] = useState(0)
  return <AdminContent key={version} onRestored={() => setVersion((v) => v + 1)} />
}

function AdminContent({ onRestored }: { onRestored: () => void }) {
  const { db, updateSettings, replaceDb } = useStore()
  const [business, setBusiness] = useState({
    businessName: db.settings.businessName,
    saleNumberFormat: db.settings.saleNumberFormat,
  })
  const [importing, setImporting] = useState<Db | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stamp = new Date().toISOString().slice(0, 10)

  const formatError = validateFormat(business.saleNumberFormat)
  const preview = formatError ? undefined : nextSaleNumber(business.saleNumberFormat, today(), db.sales)

  const saveBusiness = (e: React.FormEvent) => {
    e.preventDefault()
    if (formatError) return
    updateSettings({
      businessName: business.businessName.trim() || 'My Software Business',
      saleNumberFormat: business.saleNumberFormat,
    })
    toast.success('Saved')
  }

  const onFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!parsed || !Array.isArray(parsed.sales) || !Array.isArray(parsed.customers)) {
        throw new Error('Not a Mini ERP backup file')
      }
      setImporting(parsed)
    } catch (err) {
      toast.error(`Could not read file: ${(err as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <PageHeader title="Admin" description="Business details, currencies, and your data." />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <form onSubmit={saveBusiness} className="contents">
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" htmlFor="ad-name">
                <Input
                  id="ad-name"
                  value={business.businessName}
                  onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
                />
              </Field>
              <Field
                label="Sale number format"
                htmlFor="ad-format"
                required
                error={formatError ?? undefined}
                hint={`Next number today: ${preview}. Tokens: {YYYY} {YY} {MM} {DD} and one {####} for the sequence, which restarts whenever the date part changes.`}
              >
                <Input
                  id="ad-format"
                  className="font-mono"
                  value={business.saleNumberFormat}
                  onChange={(e) => setBusiness({ ...business, saleNumberFormat: e.target.value })}
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!!formatError}>
                Save
              </Button>
            </CardFooter>
          </form>
        </Card>

        <CurrenciesCard />

        <Card>
          <CardHeader>
            <CardTitle>Export to CSV</CardTitle>
            <CardDescription>
              Opens in Excel, Numbers or Google Sheets. The same files are also kept up to date automatically in{' '}
              <code className="bg-muted rounded px-1">data/csv/</code> every time you save something.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {CSV_EXPORTS.map(({ file, label, build }) => (
              <Button
                key={file}
                variant="outline"
                onClick={() => download(file.replace('.csv', `-${stamp}.csv`), build(db), 'text/csv;charset=utf-8')}
              >
                <DownloadIcon /> {label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup & restore</CardTitle>
            <CardDescription>
              Everything is stored in <code className="bg-muted rounded px-1">db.json</code> in your data folder, with a
              daily copy in <code className="bg-muted rounded px-1">backups/</code> next to it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => download(`mini-erp-backup-${stamp}.json`, JSON.stringify(db, null, 2), 'application/json')}
            >
              <DownloadIcon /> Download backup (JSON)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <UploadIcon /> Restore from backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </CardContent>
        </Card>

        <DataLocationCard onChanged={onRestored} />
      </div>

      <ConfirmDialog
        open={!!importing}
        onOpenChange={(o) => !o && setImporting(null)}
        title="Replace all data?"
        description={`This replaces everything with the backup (${importing?.customers.length ?? 0} customers, ${importing?.sales.length ?? 0} sales). Today's first version stays in data/backups/.`}
        confirmLabel="Replace"
        onConfirm={() => {
          if (importing) replaceDb(importing)
          toast.success('Backup restored')
          setImporting(null)
          onRestored()
        }}
      />
    </>
  )
}
