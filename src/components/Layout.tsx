import { type ReactNode, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ListOrdered, CalendarDays, ChartNoAxesCombined,
  NotebookPen, Settings as SettingsIcon, Plus, Moon, Sun, LineChart,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Trades', icon: ListOrdered },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const readTheme = () => {
  try {
    return localStorage.getItem('tj-theme') ?? 'dark'
  } catch {
    return 'dark'
  }
}

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('tj-theme', theme)
    } catch {
      /* private window or blocked storage; the theme just will not persist */
    }
  }, [theme])

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-surface-1">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-surface-0">
            <LineChart size={17} strokeWidth={2.5} />
          </span>
          <span className="text-sm font-semibold tracking-tight">Trading Journal</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 p-3">
          <button className="btn-primary w-full" onClick={() => navigate('/trades/new')}>
            <Plus size={16} /> Log trade
          </button>
          <button className="btn-subtle w-full" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Light' : 'Dark'} mode
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface-1/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-surface-0">
            <LineChart size={15} strokeWidth={2.5} />
          </span>
          <span className="text-sm font-semibold">Trading Journal</span>
        </div>
        <button className="btn-subtle !px-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface-1/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV.filter((n) => n.label !== 'Journal').map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                isActive ? 'text-accent' : 'text-ink-faint'
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => navigate('/trades/new')}
        aria-label="Log trade"
        className="fixed bottom-20 right-4 z-30 grid h-13 w-13 place-items-center rounded-full bg-accent p-4 text-surface-0 shadow-lg shadow-black/25 lg:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 lg:px-7 lg:py-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight lg:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
