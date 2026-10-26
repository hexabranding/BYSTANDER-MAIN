import { useDocumentTitle } from '@/hooks/useUi'
import { Sparkles } from 'lucide-react'
import { Container } from '@/components/common/Container'
import { PageHero } from '@/components/common/PageHero'
import { BookCaregiverWizard } from '@/components/booking/BookCaregiverWizard'

export function BookCaregiverPage() {
  useDocumentTitle('Book a Caretaker · Bystander')

  return (
    <div className="bg-sand-50/50 pb-20">
      <PageHero
        eyebrow="ON-DEMAND CARETAKER DISPATCH"
        icon={Sparkles}
        title="Book a verified"
        highlight="caretaker"
        description="Choose your service, specify care requirements, and schedule your shift. Your booking is broadcasted simultaneously to verified caretakers across your city for instant acceptance."
        items={[
          { label: 'Home', to: '/' },
          { label: 'Book Caretaker', to: '/book-caregiver' },
        ]}
      />

      <Container className="-mt-8 relative z-10">
        <div className="rounded-3xl border border-line bg-white/90 p-4 shadow-xl backdrop-blur-sm sm:p-8">
          <BookCaregiverWizard isPublic={true} />
        </div>
      </Container>
    </div>
  )
}

export default BookCaregiverPage
