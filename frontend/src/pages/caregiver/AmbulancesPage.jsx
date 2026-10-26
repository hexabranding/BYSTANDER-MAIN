import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/common/PageHeader'
import { AmbulanceDirectory } from '@/components/ambulance/AmbulanceDirectory'

export function CaregiverAmbulancesPage() {
  useDocumentTitle('Emergency Ambulances · Caregiver')
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Ambulance Dispatch"
        subtitle="Direct phone numbers of ambulance drivers on call to transport patients immediately."
      />
      <AmbulanceDirectory userCity={user?.city || 'Mumbai'} />
    </div>
  )
}

export default CaregiverAmbulancesPage
