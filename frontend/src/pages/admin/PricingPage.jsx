import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Tag,
  Percent,
  Banknote,
  Shield,
  Calendar,
  Sparkles,
  Calculator,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useUi'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { StatCard } from '@/components/common/StatCard'
import { FormField, Input, Select } from '@/components/forms/FormField'
import { TableSkeleton } from '@/components/common/States'
import { formatCurrency, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { adminService } from '@/services/adminService'

const DEFAULT_TIERS = [
  { minReviews: 30, minRating: 4.7, rate: 275, increment: 75, label: 'Silver' },
  { minReviews: 50, minRating: 4.8, rate: 350, increment: 75, label: 'Gold' },
  { minReviews: 70, minRating: 4.8, rate: 425, increment: 75, label: 'Diamond' },
  { minReviews: 90, minRating: 4.8, rate: 500, increment: 75, label: 'Platinum' },
]

export function PricingPage() {
  useDocumentTitle('Pricing & Revenue Configuration')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Pricing settings state
  const [serviceBaseRate, setServiceBaseRate] = useState(199)
  const [initialRate, setInitialRate] = useState(200)
  const [maxCap, setMaxCap] = useState(500)
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(true)
  const [tiers, setTiers] = useState(DEFAULT_TIERS)

  const [baseDailyRate, setBaseDailyRate] = useState(1500)
  const [extraDayDiscount, setExtraDayDiscount] = useState(250)

  const [monthlyUseFormula, setMonthlyUseFormula] = useState(true)
  const [fixedMonthlyPackage, setFixedMonthlyPackage] = useState(37500)

  // Services catalog list
  const [services, setServices] = useState([])
  const [serviceRates, setServiceRates] = useState({})
  const [initialSnapshot, setInitialSnapshot] = useState(null)

  // Simulator State
  const [simMode, setSimMode] = useState('daily')
  const [simDays, setSimDays] = useState(3)
  const [simHours, setSimHours] = useState(8)
  const [simReviews, setSimReviews] = useState(55)
  const [simRating, setSimRating] = useState(4.9)
  const [simServiceId, setSimServiceId] = useState('')

  const fetchPricing = async () => {
    setIsLoading(true)
    try {
      const res = await adminService.getAdminPricing()
      let loadedPricing = {}
      if (res?.pricing) {
        const p = res.pricing
        loadedPricing = p
        setServiceBaseRate(p.serviceBaseRate ?? 199)
        setInitialRate(p.hourly?.initialRate ?? 200)
        setMaxCap(p.hourly?.maxCap ?? 500)
        setDynamicPricingEnabled(p.hourly?.dynamicPricingEnabled ?? true)
        if (Array.isArray(p.hourly?.tiers) && p.hourly.tiers.length > 0) {
          setTiers(p.hourly.tiers)
        }
        setBaseDailyRate(p.daily?.baseDailyRate ?? 1500)
        setExtraDayDiscount(p.daily?.extraDayDiscount ?? 250)
        setMonthlyUseFormula(p.monthly?.useFormula ?? true)
        setFixedMonthlyPackage(p.monthly?.fixedPackageRate ?? 37500)
      }
      let loadedRates = {}
      if (Array.isArray(res?.services)) {
        setServices(res.services)
        const ratesMap = {}
        res.services.forEach((s) => {
          ratesMap[s._id] = s.baseHourlyRate ?? 199
        })
        setServiceRates(ratesMap)
        loadedRates = ratesMap
        if (res.services.length > 0 && !simServiceId) {
          setSimServiceId(res.services[0]._id)
        }
      }
      setInitialSnapshot(
        JSON.stringify({
          serviceBaseRate: loadedPricing.serviceBaseRate ?? 199,
          initialRate: loadedPricing.hourly?.initialRate ?? 200,
          maxCap: loadedPricing.hourly?.maxCap ?? 500,
          dynamicPricingEnabled: loadedPricing.hourly?.dynamicPricingEnabled ?? true,
          tiers: loadedPricing.hourly?.tiers || DEFAULT_TIERS,
          baseDailyRate: loadedPricing.daily?.baseDailyRate ?? 1500,
          extraDayDiscount: loadedPricing.daily?.extraDayDiscount ?? 250,
          monthlyUseFormula: loadedPricing.monthly?.useFormula ?? true,
          fixedMonthlyPackage: loadedPricing.monthly?.fixedPackageRate ?? 37500,
          serviceRates: loadedRates,
        })
      )
    } catch (err) {
      toast.error('Failed to load pricing configuration', {
        description: err?.message || 'Using local standard defaults.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = useMemo(() => {
    if (!initialSnapshot) return false
    try {
      const snap = JSON.parse(initialSnapshot)
      if (Number(serviceBaseRate) !== snap.serviceBaseRate) return true
      if (Number(initialRate) !== snap.initialRate) return true
      if (Number(maxCap) !== snap.maxCap) return true
      if (Boolean(dynamicPricingEnabled) !== Boolean(snap.dynamicPricingEnabled)) return true
      if (Number(baseDailyRate) !== snap.baseDailyRate) return true
      if (Number(extraDayDiscount) !== snap.extraDayDiscount) return true
      if (Boolean(monthlyUseFormula) !== Boolean(snap.monthlyUseFormula)) return true
      if (Number(fixedMonthlyPackage) !== snap.fixedMonthlyPackage) return true
      if (JSON.stringify(tiers) !== JSON.stringify(snap.tiers)) return true
      if (JSON.stringify(serviceRates) !== JSON.stringify(snap.serviceRates)) return true
    } catch (_) {}
    return false
  }, [
    initialSnapshot,
    serviceBaseRate,
    initialRate,
    maxCap,
    dynamicPricingEnabled,
    tiers,
    baseDailyRate,
    extraDayDiscount,
    monthlyUseFormula,
    fixedMonthlyPackage,
    serviceRates,
  ])

  const handleDiscardChanges = () => {
    if (!initialSnapshot) return
    try {
      const snap = JSON.parse(initialSnapshot)
      setServiceBaseRate(snap.serviceBaseRate)
      setInitialRate(snap.initialRate)
      setMaxCap(snap.maxCap)
      setDynamicPricingEnabled(snap.dynamicPricingEnabled)
      setTiers(snap.tiers)
      setBaseDailyRate(snap.baseDailyRate)
      setExtraDayDiscount(snap.extraDayDiscount)
      setMonthlyUseFormula(snap.monthlyUseFormula)
      setFixedMonthlyPackage(snap.fixedMonthlyPackage)
      setServiceRates(snap.serviceRates)
      toast.info('Unsaved pricing changes discarded.')
    } catch (_) {}
  }

  useEffect(() => {
    fetchPricing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Multi-day discount preview table computation
  const multiDayBreakdown = useMemo(() => {
    const intervals = [1, 2, 3, 4, 5, 7, 14, 30]
    return intervals.map((d) => {
      const gross = d * Number(baseDailyRate || 1500)
      const discount = Math.max(0, (d - 1) * Number(extraDayDiscount || 250))
      const net = Math.max(0, gross - discount)
      return {
        days: d,
        gross,
        discount,
        net,
        avgPerDay: Math.round(net / d),
      }
    })
  }, [baseDailyRate, extraDayDiscount])

  // Real-time live simulator calculation
  const simulationResult = useMemo(() => {
    const selService = services.find((s) => String(s._id) === String(simServiceId))
    const sRate = serviceRates[simServiceId] || selService?.baseHourlyRate || serviceBaseRate

    let baseAmount = 0
    let grossAmount = 0
    let discountAmount = 0
    let effectiveRate = initialRate
    let unlockedTier = null

    if (simMode === 'daily') {
      const d = Math.max(1, Number(simDays) || 1)
      grossAmount = d * Number(baseDailyRate || 1500)
      discountAmount = Math.max(0, (d - 1) * Number(extraDayDiscount || 250))
      baseAmount = Math.max(0, grossAmount - discountAmount)
      effectiveRate = Math.round(baseAmount / (d * 24))
    } else if (simMode === 'monthly') {
      const gross = 30 * Number(baseDailyRate || 1500)
      if (monthlyUseFormula) {
        discountAmount = 29 * Number(extraDayDiscount || 250)
        baseAmount = Math.max(0, gross - discountAmount)
      } else {
        baseAmount = Number(fixedMonthlyPackage || 37500)
        discountAmount = Math.max(0, gross - baseAmount)
      }
      grossAmount = gross
      effectiveRate = Math.round(baseAmount / (30 * 24))
    } else {
      // Hourly
      const h = Math.max(2, Number(simHours) || 2)
      if (dynamicPricingEnabled) {
        const sorted = [...tiers].sort((a, b) => a.minReviews - b.minReviews)
        for (const t of sorted) {
          if (simReviews >= t.minReviews && simRating >= t.minRating) {
            unlockedTier = t
          }
        }
        if (unlockedTier) {
          effectiveRate = Number(unlockedTier.rate)
        } else {
          effectiveRate = Number(initialRate)
        }
      } else {
        effectiveRate = Number(initialRate)
      }

      if (sRate && sRate > effectiveRate) {
        effectiveRate = sRate
      }
      effectiveRate = Math.min(Number(maxCap), effectiveRate)

      baseAmount = Math.round(effectiveRate * h)
      grossAmount = baseAmount
      discountAmount = 0
    }

    const platformFee = 49
    const tax = Math.round((baseAmount + platformFee) * 0.18)
    const commission = Math.round(baseAmount * 0.12)
    const caregiverPayout = baseAmount - commission
    const totalCustomerBill = baseAmount + platformFee + tax

    return {
      unlockedTier,
      effectiveRate,
      grossAmount,
      discountAmount,
      baseAmount,
      platformFee,
      tax,
      totalCustomerBill,
      commission,
      caregiverPayout,
    }
  }, [
    simMode,
    simDays,
    simHours,
    simReviews,
    simRating,
    simServiceId,
    services,
    serviceRates,
    serviceBaseRate,
    initialRate,
    maxCap,
    dynamicPricingEnabled,
    tiers,
    baseDailyRate,
    extraDayDiscount,
    monthlyUseFormula,
    fixedMonthlyPackage,
  ])

  const handleAddTier = () => {
    const nextReviews = (tiers[tiers.length - 1]?.minReviews || 80) + 20
    const nextRate = Math.min(maxCap, (tiers[tiers.length - 1]?.rate || 400) + 50)
    setTiers([
      ...tiers,
      {
        minReviews: nextReviews,
        minRating: 4.8,
        rate: nextRate,
        increment: 50,
        label: `Tier ${tiers.length + 1}`,
      },
    ])
  }

  const handleRemoveTier = (index) => {
    setTiers(tiers.filter((_, idx) => idx !== index))
  }

  const handleUpdateTier = (index, field, value) => {
    const updated = [...tiers]
    updated[index] = {
      ...updated[index],
      [field]: field === 'label' ? value : Number(value) || 0,
    }
    setTiers(updated)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = {
        pricing: {
          serviceBaseRate: Number(serviceBaseRate),
          hourly: {
            initialRate: Number(initialRate),
            maxCap: Number(maxCap),
            dynamicPricingEnabled,
            tiers: tiers.map((t) => ({
              minReviews: Number(t.minReviews),
              minRating: Number(t.minRating),
              rate: Number(t.rate),
              increment: Number(t.increment) || 75,
              label: t.label || 'Milestone',
            })),
          },
          daily: {
            baseDailyRate: Number(baseDailyRate),
            extraDayDiscount: Number(extraDayDiscount),
          },
          monthly: {
            useFormula: monthlyUseFormula,
            fixedPackageRate: Number(fixedMonthlyPackage),
          },
        },
        serviceRates: Object.entries(serviceRates).map(([serviceId, rate]) => ({
          serviceId,
          baseHourlyRate: Number(rate),
        })),
      }

      await adminService.updateAdminPricing(payload)
      toast.success('Platform pricing updated successfully', {
        description: 'All new bookings and caretaker rates reflect these settings immediately.',
      })
      await fetchPricing()
    } catch (err) {
      toast.error('Failed to update pricing settings', {
        description: err?.message || 'Please check your inputs and try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefaults = () => {
    setServiceBaseRate(199)
    setInitialRate(200)
    setMaxCap(500)
    setDynamicPricingEnabled(true)
    setTiers(DEFAULT_TIERS)
    setBaseDailyRate(1500)
    setExtraDayDiscount(250)
    setMonthlyUseFormula(true)
    setFixedMonthlyPackage(37500)
    toast.info('Reset to standard platform defaults. Click "Save changes" to apply.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing & Revenue Configuration"
        subtitle="Configure platform-wide service rates, caretaker review progression tiers, and multi-day discounts in real time."
        action={
          hasChanges ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={handleDiscardChanges}
                disabled={isLoading || isSaving}
              >
                Discard
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Save}
                loading={isSaving}
                onClick={handleSave}
                disabled={isLoading}
              >
                Save changes
              </Button>
            </div>
          ) : null
        }
      />

      {isLoading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : (
        <>
          {/* Top Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Caretaker Initial Rate"
              value={`₹ ${formatNumber(initialRate)} / hr`}
              icon={Banknote}
              tone="primary"
              hint="Starting rate for new caretakers"
            />
            <StatCard
              label="Max Price Ceiling"
              value={`₹ ${formatNumber(maxCap)} / hr`}
              icon={Shield}
              tone="neutral"
              hint="Absolute platform ceiling"
            />
            <StatCard
              label="Base Daily Shift Rate"
              value={`₹ ${formatNumber(baseDailyRate)} / day`}
              icon={Calendar}
              tone="accent"
              hint="Standard 24-hr day shift"
            />
            <StatCard
              label="Extra-Day Discount"
              value={`- ₹ ${formatNumber(extraDayDiscount)}`}
              icon={Percent}
              tone="success"
              hint="Deducted per additional day"
            />
          </div>

          {/* Section 1: Services Catalog Base Rates */}
          <Card>
            <CardHeader
              title="1. Service Catalog Base Pricing"
              subtitle="Set and adjust the base hourly rate for each offering in the service catalog."
              icon={Layers}
            />
            <CardBody className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-slate-50/80 font-bold uppercase tracking-wider text-faint">
                      <th className="px-4 py-3">Service Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Min Hours</th>
                      <th className="px-4 py-3 text-right">Base Hourly Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {services.map((s) => (
                      <tr key={s._id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-ink">{s.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
                            {s.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{s.minimumDurationHours || 2} hrs</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <span className="font-semibold text-muted">₹</span>
                            <input
                              type="number"
                              min={50}
                              max={5000}
                              value={serviceRates[s._id] ?? s.baseHourlyRate ?? 199}
                              onChange={(e) => {
                                const val = Number(e.target.value)
                                setServiceRates((prev) => ({
                                  ...prev,
                                  [s._id]: val,
                                }))
                              }}
                              className="w-24 rounded-lg border border-line bg-white px-2.5 py-1 text-right text-xs font-bold text-ink focus:border-primary-600 focus:outline-none"
                            />
                            <span className="text-muted">/hr</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Section 2: Caretaker Hourly Rates & Review Milestone Progression */}
          <Card>
            <CardHeader
              title="2. Caretaker Hourly Rates & Review Progression Tiers"
              subtitle="Configure baseline starting prices and review milestone tiers that unlock higher earnings."
              icon={Sparkles}
            />
            <CardBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Initial Caretaker Rate (₹/hr)" hint="Starting price for 0-29 reviews">
                  <Input
                    type="number"
                    min={50}
                    max={1000}
                    value={initialRate}
                    onChange={(e) => setInitialRate(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Maximum Price Ceiling (₹/hr)" hint="Highest allowable caretaker rate">
                  <Input
                    type="number"
                    min={initialRate}
                    max={5000}
                    value={maxCap}
                    onChange={(e) => setMaxCap(Number(e.target.value))}
                  />
                </FormField>
                <div className="flex flex-col justify-center space-y-1 rounded-xl border border-line bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      Review-Based Dynamic Pricing
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={dynamicPricingEnabled}
                      onClick={() => setDynamicPricingEnabled(!dynamicPricingEnabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none',
                        dynamicPricingEnabled ? 'bg-primary-700' : 'bg-slate-300',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                          dynamicPricingEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-faint">
                    {dynamicPricingEnabled
                      ? 'Enabled: Caretakers automatically graduate to higher rates when passing review milestones.'
                      : 'Disabled: All caretakers remain on static starting rate.'}
                  </p>
                </div>
              </div>

              {/* Milestone Tiers Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Milestone Progression Tiers
                  </h4>
                  <Button size="xs" variant="outline" icon={Plus} onClick={handleAddTier}>
                    Add milestone tier
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-slate-50 font-bold uppercase tracking-wider text-faint">
                        <th className="px-4 py-3">Tier Label</th>
                        <th className="px-4 py-3">Reviews Required</th>
                        <th className="px-4 py-3">Min Star Rating</th>
                        <th className="px-4 py-3 text-right">Resulting Rate (₹/hr)</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {tiers.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={t.label || `Tier ${idx + 1}`}
                              onChange={(e) => handleUpdateTier(idx, 'label', e.target.value)}
                              className="w-28 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-ink focus:border-primary-600 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                value={t.minReviews}
                                onChange={(e) => handleUpdateTier(idx, 'minReviews', e.target.value)}
                                className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold text-ink focus:border-primary-600 focus:outline-none"
                              />
                              <span className="text-muted">reviews</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-500">★</span>
                              <input
                                type="number"
                                step={0.1}
                                min={1}
                                max={5}
                                value={t.minRating}
                                onChange={(e) => handleUpdateTier(idx, 'minRating', e.target.value)}
                                className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold text-ink focus:border-primary-600 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1 font-semibold text-ink">
                              <span className="text-muted">₹</span>
                              <input
                                type="number"
                                min={initialRate}
                                max={maxCap}
                                value={t.rate}
                                onChange={(e) => handleUpdateTier(idx, 'rate', e.target.value)}
                                className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-right text-xs font-bold text-primary-700 focus:border-primary-600 focus:outline-none"
                              />
                              <span className="text-muted">/hr</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveTier(idx)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete tier"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual progression summary pill track */}
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-gradient-to-r from-mint-50 to-white p-3 text-xs">
                  <span className="font-bold text-primary-900">Progression Path:</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-ink shadow-xs border border-line">
                    0–{tiers[0]?.minReviews ? tiers[0].minReviews - 1 : 29} revs: ₹{initialRate}/hr (Base)
                  </span>
                  {tiers.map((t, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <span className="text-muted font-bold">→</span>
                      <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-primary-800 shadow-xs border border-line">
                        {t.minReviews}+ revs (≥{t.minRating}★): ₹{t.rate}/hr ({t.label})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Section 3: Daily & Multi-Day Progressive Discount Engine */}
          <Card>
            <CardHeader
              title="3. Daily & Multi-Day Progressive Discount Engine"
              subtitle="Set the 1-day base rate and progressive discounts that reward customers for booking extended shifts."
              icon={Calendar}
            />
            <CardBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Base 1-Day Shift Rate (₹)" hint="Standard 24-hr day shift fee">
                  <Input
                    type="number"
                    min={300}
                    max={10000}
                    value={baseDailyRate}
                    onChange={(e) => setBaseDailyRate(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Extra-Day Discount (₹)" hint="Deducted for each day added beyond Day 1">
                  <Input
                    type="number"
                    min={0}
                    max={baseDailyRate}
                    value={extraDayDiscount}
                    onChange={(e) => setExtraDayDiscount(Number(e.target.value))}
                  />
                </FormField>
              </div>

              {/* Schedule Breakdown Live Preview Table */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Multi-Day Progressive Discount Schedule (Live Calculation)
                </p>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-slate-50 font-bold uppercase tracking-wider text-faint">
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Formula</th>
                        <th className="px-4 py-3">Total Discount Given</th>
                        <th className="px-4 py-3 text-right">Customer Net Price</th>
                        <th className="px-4 py-3 text-right">Average / Day</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {multiDayBreakdown.map((row) => (
                        <tr key={row.days} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-ink">
                            {row.days} {row.days === 1 ? 'Day' : 'Days'}
                            {row.days === 7 ? ' (1 Week)' : row.days === 30 ? ' (1 Month)' : ''}
                          </td>
                          <td className="px-4 py-2.5 text-muted">
                            {row.days === 1
                              ? `1 × ₹${baseDailyRate}`
                              : `(${row.days} × ₹${baseDailyRate}) − (${row.days - 1} × ₹${extraDayDiscount})`}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.discount > 0 ? (
                              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                − {formatCurrency(row.discount)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-display font-extrabold text-primary-800">
                            {formatCurrency(row.net)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-muted">
                            {formatCurrency(row.avgPerDay)} / day
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Section 4: Monthly Schedule Package (30 Days) */}
          <Card>
            <CardHeader
              title="4. Monthly Schedule Package (30 Days)"
              subtitle="Configure whether 1-month bookings use the progressive discount formula or a fixed flat package rate."
              icon={Clock}
            />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  onClick={() => setMonthlyUseFormula(true)}
                  className={cn(
                    'cursor-pointer rounded-xl border p-4 transition-all',
                    monthlyUseFormula
                      ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500/20'
                      : 'border-line bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={monthlyUseFormula}
                      onChange={() => setMonthlyUseFormula(true)}
                      className="text-primary-700"
                    />
                    <span className="font-bold text-ink">Use Progressive Formula</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Automatically computes using the daily formula with progressive multi-day discounts.
                    Current 30-day rate: <strong className="text-ink">{formatCurrency(multiDayBreakdown[7]?.net || 37750)}</strong>.
                  </p>
                </div>

                <div
                  onClick={() => setMonthlyUseFormula(false)}
                  className={cn(
                    'cursor-pointer rounded-xl border p-4 transition-all',
                    !monthlyUseFormula
                      ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500/20'
                      : 'border-line bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!monthlyUseFormula}
                      onChange={() => setMonthlyUseFormula(false)}
                      className="text-primary-700"
                    />
                    <span className="font-bold text-ink">Use Fixed Flat Package Rate</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted">Fixed Rate: ₹</span>
                    <input
                      type="number"
                      min={5000}
                      max={200000}
                      value={fixedMonthlyPackage}
                      disabled={monthlyUseFormula}
                      onChange={(e) => setFixedMonthlyPackage(Number(e.target.value))}
                      className="w-32 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-ink disabled:bg-slate-100"
                    />
                    <span className="text-xs text-muted">/ 30 days</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Section 5: Real-Time Interactive Quote Simulator Sandbox */}
          <Card>
            <CardHeader
              title="5. Real-Time Quote Simulator Sandbox"
              subtitle="Test how your active pricing rules, tiers, and multi-day discounts calculate for customers before saving."
              icon={Calculator}
            />
            <CardBody className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Simulator Inputs */}
                <div className="space-y-4 rounded-xl border border-line bg-slate-50/60 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Test Scenario Parameters</h4>

                  <div>
                    <label className="block text-xs font-bold text-ink">Booking Mode</label>
                    <div className="mt-1.5 flex gap-2">
                      {['hourly', 'daily', 'monthly'].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSimMode(mode)}
                          className={cn(
                            'flex-1 rounded-lg border py-2 text-xs font-bold capitalize transition-all',
                            simMode === mode
                              ? 'border-primary-700 bg-primary-700 text-white shadow-xs'
                              : 'border-line bg-white text-ink hover:bg-slate-100',
                          )}
                        >
                          {mode === 'hourly' ? '⏱️ Hourly' : mode === 'daily' ? '📅 Daily' : '🗓️ Monthly'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {simMode === 'hourly' ? (
                    <FormField label={`Shift Duration: ${simHours} hours`}>
                      <input
                        type="range"
                        min={2}
                        max={24}
                        value={simHours}
                        onChange={(e) => setSimHours(Number(e.target.value))}
                        className="w-full"
                      />
                    </FormField>
                  ) : simMode === 'daily' ? (
                    <FormField label={`Duration: ${simDays} days`}>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={simDays}
                        onChange={(e) => setSimDays(Number(e.target.value))}
                        className="w-full"
                      />
                    </FormField>
                  ) : (
                    <div className="rounded-lg bg-mint-50 p-3 text-xs text-primary-900">
                      Standard 30-day comprehensive care plan selected.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={`Caretaker Reviews: ${simReviews}`}>
                      <input
                        type="range"
                        min={0}
                        max={120}
                        value={simReviews}
                        onChange={(e) => setSimReviews(Number(e.target.value))}
                        className="w-full"
                      />
                    </FormField>
                    <FormField label="Average Star Rating">
                      <Select value={simRating} onChange={(e) => setSimRating(Number(e.target.value))}>
                        <option value={5.0}>5.0 ★ Flawless</option>
                        <option value={4.9}>4.9 ★ Excellent</option>
                        <option value={4.8}>4.8 ★ Great</option>
                        <option value={4.7}>4.7 ★ Good</option>
                        <option value={4.5}>4.5 ★ Average</option>
                      </Select>
                    </FormField>
                  </div>

                  <FormField label="Service Offering">
                    <Select value={simServiceId} onChange={(e) => setSimServiceId(e.target.value)}>
                      {services.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} (Base: ₹{serviceRates[s._id] || s.baseHourlyRate || 199}/hr)
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                {/* Simulator Live Output */}
                <div className="flex flex-col justify-between rounded-xl border border-primary-200 bg-gradient-to-br from-mint-50/50 via-white to-slate-50 p-5 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          Unlocked Caretaker Tier
                        </span>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="font-display text-base font-bold text-ink">
                            {simulationResult.unlockedTier
                              ? `${simulationResult.unlockedTier.label} Specialist`
                              : 'Base Starter Caretaker'}
                          </span>
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-extrabold text-primary-800">
                            ₹ {simulationResult.effectiveRate} / hr
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        {simMode.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="flex justify-between text-muted">
                        <span>Gross Shift Amount</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {formatCurrency(simulationResult.grossAmount)}
                        </span>
                      </div>
                      {simulationResult.discountAmount > 0 ? (
                        <div className="flex justify-between font-semibold text-emerald-700">
                          <span>Multi-Day Progressive Discount</span>
                          <span className="tabular-nums">− {formatCurrency(simulationResult.discountAmount)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-muted">
                        <span>Base Shift Bill</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {formatCurrency(simulationResult.baseAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>Platform Escrow Fee</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {formatCurrency(simulationResult.platformFee)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>GST (18%)</span>
                        <span className="tabular-nums font-semibold text-ink">
                          {formatCurrency(simulationResult.tax)}
                        </span>
                      </div>
                      <div className="border-t border-line pt-2 flex justify-between font-display text-base font-extrabold text-primary-900">
                        <span>Total Customer Pays</span>
                        <span>{formatCurrency(simulationResult.totalCustomerBill)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-line bg-white/80 p-3 text-xs">
                    <p className="font-bold text-ink">Financial Operations Split</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="text-faint">Platform Commission (12%)</span>
                        <p className="font-bold text-ink">{formatCurrency(simulationResult.commission)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-900">
                        <span className="text-emerald-700">Caretaker Net Payout</span>
                        <p className="font-bold">{formatCurrency(simulationResult.caregiverPayout)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}

export default PricingPage

