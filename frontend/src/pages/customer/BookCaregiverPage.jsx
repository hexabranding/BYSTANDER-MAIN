import { useDocumentTitle } from '@/hooks/useUi'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { BookCaregiverWizard } from '@/components/booking/BookCaregiverWizard'

export function BookCaregiverPage() {
  useDocumentTitle('Book Caretaker · Bystander')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book a caretaker"
        subtitle="Submit your care details. Your booking will be instantly broadcasted to all active caretakers."
        action={
          <Button to="/customer/bookings" variant="ghost" size="sm">
            My bookings
          </Button>
        }
      />
      <BookCaregiverWizard isPublic={false} />
    </div>
  )
}

export default BookCaregiverPage
