import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X, HeartHandshake } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/common/Button'

const links = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Find Caregivers', to: '/caregivers' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Contact', to: '/contact' },
]

const dashboardFor = (role) => (role === 'admin' ? '/admin/dashboard' : role === 'caregiver' ? '/caregiver/dashboard' : '/customer/dashboard')

export function PublicNavbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const { isLoggedIn, user, logout } = useAuth()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-all duration-300',
        scrolled ? 'border-line bg-white/90 backdrop-blur-md shadow-card' : 'border-transparent bg-white',
      )}
    >
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo size="lg" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((link) =>
            link.to.includes('#') ? (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition hover:bg-slate-100 hover:text-ink"
              >
                {link.label}
              </Link>
            ) : (
              <NavLink
                key={link.label}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition',
                    isActive ? 'text-primary-700' : 'text-muted hover:bg-slate-100 hover:text-ink',
                  )
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          {isLoggedIn ? (
            <>
              <Button to={dashboardFor(user.role)} variant="outline" size="sm">
                My Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button to="/login" variant="outline" size="sm">
                Login
              </Button>
              <Button to="/register" size="sm" icon={HeartHandshake}>
                Get Started
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-white px-4 pb-5 pt-3 shadow-raised lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid gap-2 border-t border-line pt-4">
            {isLoggedIn ? (
              <>
                <Button to={dashboardFor(user.role)} size="sm">
                  My Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button to="/login" variant="outline" size="sm">
                  Login
                </Button>
                <Button to="/register" size="sm">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  )
}

export default PublicNavbar
