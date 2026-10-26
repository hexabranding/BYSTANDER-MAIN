import { useDocumentTitle } from '@/hooks/useUi'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/common/PageHeader'
import { AmbulanceDirectory } from '@/components/ambulance/AmbulanceDirectory'

export function CustomerAmbulancesPage() {
  useDocumentTitle('Emergency Ambulances · Bystander')
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Ambulances"
        subtitle="Call verified ambulance drivers equipped with ICU, oxygen, and paramedic support."
      />
      <AmbulanceDirectory userCity={user?.city || 'Mumbai'} />
    </div>
  )
}

export default CustomerAmbulancesPage
