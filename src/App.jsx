import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { AppRoutes } from '@/routes'
import { ScrollToHash, ScrollToTop } from '@/routes/ScrollHelpers'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ScrollToTop />
          <ScrollToHash />
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              classNames: {
                toast: 'font-sans',
              },
            }}
            richColors
            closeButton
          />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
