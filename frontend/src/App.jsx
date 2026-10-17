import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { DataProvider } from '@/context/DataContext'
import { AppRoutes } from '@/routes'
import { ScrollToHash, ScrollToTop } from '@/routes/ScrollHelpers'
import { ScrollProgress } from '@/components/common/ScrollProgress'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          {/* Keep every motion effect, including scroll-linked ones on the
              public pages, aligned with the OS reduced-motion setting. */}
          <MotionConfig reducedMotion="user">
            <ScrollToTop />
            <ScrollToHash />
            <ScrollProgress />
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
          </MotionConfig>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
