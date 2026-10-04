import { useRef, useState } from 'react'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { PageHeader } from '@/components/page-header'
import { download, salesToCsv } from '@/lib/csv'
import { today } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Db } from '@/lib/types'

const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'INR']

export function SettingsPage() {
  const { db, updateSettings, replaceDb } = useStore()
  const [form, setForm] = useState(db.settings)
  const [importing, setImporting] = useState<Db | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const currency = form.currency.trim().toUpperCase()
    try {
      new Intl.NumberFormat(undefined, { style: 'currency', currency })
    } catch {
      toast.error(`"${currency}" is not a valid ISO currency code`)
      return
    }
    updateSettings({ ...form, currency, businessName: form.businessName.trim() || 'My Software Business' })
    toast.success('Settings saved')
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
      <PageHeader title="Settings" />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={save} className="contents">
            <CardHeader>
              <CardTitle>Business</CardTitle>
              <CardDescription>
                All amounts use one currency. Changing it relabels existing amounts; nothing is converted.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" htmlFor="st-name" className="sm:col-span-2">
                <Input
                  id="st-name"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </Field>
              <Field label="Currency (ISO code)" htmlFor="st-currency">
                <Input
                  id="st-currency"
                  list="currencies"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
                <datalist id="currencies">
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Sale number prefix" htmlFor="st-prefix">
                <Input
                  id="st-prefix"
                  value={form.salePrefix}
                  onChange={(e) => setForm({ ...form, salePrefix: e.target.value })}
                />
              </Field>
            </CardContent>
            <CardFooter>
              <Button type="submit">Save settings</Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your data</CardTitle>
            <CardDescription>
              Everything is stored in <code className="bg-muted rounded px-1">data/db.json</code> inside the
              project folder, with a daily copy in <code className="bg-muted rounded px-1">data/backups/</code>.
              Back up that folder, or download a backup here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => download(`mini-erp-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json')}
            >
              <DownloadIcon /> Download backup (JSON)
            </Button>
            <Button
              variant="outline"
              disabled={db.sales.length === 0}
              onClick={() => download(`sales-${today()}.csv`, salesToCsv(db), 'text/csv')}
            >
              <DownloadIcon /> Export sales (CSV)
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
      </div>

      <ConfirmDialog
        open={!!importing}
        onOpenChange={(o) => !o && setImporting(null)}
        title="Replace all data?"
        description={`This replaces everything with the backup (${importing?.customers.length ?? 0} customers, ${importing?.sales.length ?? 0} sales). Your current data is overwritten, though today's first version stays in data/backups/.`}
        confirmLabel="Replace"
        onConfirm={() => {
          if (importing) {
            replaceDb(importing)
            setForm({ ...db.settings, ...importing.settings })
          }
          toast.success('Backup restored')
          setImporting(null)
        }}
      />
    </>
  )
}
