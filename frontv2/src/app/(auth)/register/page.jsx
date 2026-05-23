import { Suspense } from 'react'
import RegisterForm from '@/components/auth/RegisterForm'
import VisitTracker from '@/components/analytics/VisitTracker'

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <VisitTracker path="/register" />
      <RegisterForm />
    </Suspense>
  )
}
