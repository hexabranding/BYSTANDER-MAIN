import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Home, Search, SearchX } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { Button } from '@/components/common/Button'

export function NotFoundPage() {
  useDocumentTitle('Page Not Found')
  const navigate = useNavigate()
  const [term, setTerm] = useState('')

  const onSearch = (event) => {
    event.preventDefault()
    const q = term.trim()
    if (q) {
      navigate(`/caregivers?search=${encodeURIComponent(q)}`)
    } else {
      navigate('/caregivers')
    }
  }

  return (
    <div className="bg-canvas">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full"
        >
          <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-3xl border border-line bg-white shadow-raised">
            <SearchX className="h-10 w-10 text-primary-700" />
            <span className="absolute -right-3 -top-3 rounded-full bg-accent-400 px-2.5 py-1 font-display text-xs font-extrabold text-[#06263B]">
              404
            </span>
          </div>

          <p className="mt-7 font-display text-6xl font-extrabold tracking-tight text-mint-200 sm:text-7xl">404</p>

          <h1 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">Page not found</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            The page you are looking for may have moved, been renamed, or never existed. Check the address, search
            for a caretaker, or head back to the homepage.
          </p>

          <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-lg flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor="nf-search" className="sr-only">
                Search caretakers
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                id="nf-search"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Try “nurse in Mumbai” or “night-duty care”"
                className="h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-3.5 text-sm text-ink placeholder:text-faint transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 focus:outline-none"
              />
            </div>
            <Button type="submit" size="md" iconRight={ArrowRight}>
              Search
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button to="/" size="lg" icon={Home} className="w-full sm:w-auto">
              Back to home
            </Button>
            <Button to="/services" variant="outline" size="lg" className="w-full sm:w-auto">
              Browse services
            </Button>
            <Button variant="ghost" size="lg" icon={ArrowLeft} onClick={() => navigate(-1)} className="w-full sm:w-auto">
              Go back
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-6 text-xs text-muted">
            <Link to="/book-caregiver" className="transition hover:text-primary-700">
              Book a caretaker
            </Link>
            <Link to="/contact" className="transition hover:text-primary-700">
              Contact support
            </Link>
            <Link to="/#faq" className="transition hover:text-primary-700">
              FAQs
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default NotFoundPage
