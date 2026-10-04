import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import {
  BarChart3Icon,
  BoxIcon,
  ContactRoundIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeToggle } from '@/components/theme-toggle'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { AdminPage } from '@/pages/admin'
import { CustomerDetailPage } from '@/pages/customer-detail'
import { CustomersPage } from '@/pages/customers'
import { DashboardPage } from '@/pages/dashboard'
import { InsightsPage } from '@/pages/insights'
import { ProductsPage } from '@/pages/products'
import { SaleDetailPage } from '@/pages/sale-detail'
import { SalesPage } from '@/pages/sales'
import { TeamDetailPage } from '@/pages/team-detail'
import { TeamPage } from '@/pages/team'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/sales', label: 'Sales', icon: ReceiptIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/team', label: 'Sales team', icon: ContactRoundIcon },
  { to: '/products', label: 'Products', icon: BoxIcon },
  { to: '/insights', label: 'Insights', icon: BarChart3Icon },
  { to: '/admin', label: 'Admin', icon: ShieldIcon },
]

function SaveIndicator() {
  const { saveState } = useStore()
  if (saveState === 'error') {
    return <span className="text-destructive text-xs">Not saved: is the server running?</span>
  }
  return (
    <span className="text-muted-foreground text-xs">{saveState === 'saving' ? 'Saving…' : 'All changes saved'}</span>
  )
}

export default function App() {
  const { db } = useStore()
  return (
    <BrowserRouter>
      <div className="flex min-h-svh flex-col md:flex-row">
        <aside className="bg-muted/30 flex shrink-0 flex-col border-b md:sticky md:top-0 md:h-svh md:w-56 md:border-r md:border-b-0">
          <div className="flex items-center justify-between px-4 py-4 md:block">
            <div className="truncate font-semibold tracking-tight">{db.settings.businessName}</div>
            <div className="flex items-center gap-3 md:mt-1">
              <SaveIndicator />
              <ThemeToggle className="md:hidden" />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto hidden px-4 py-4 md:block">
            <ThemeToggle />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales/:id" element={<SaleDetailPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/team/:id" element={<TeamDetailPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/settings" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  )
}
