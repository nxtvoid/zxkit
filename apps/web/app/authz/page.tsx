import type { Metadata } from 'next'
import { AuthzView } from './_components/authz-view'

export const metadata: Metadata = {
  title: '@zxkit/authz',
  description: 'Typed authorization helpers for roles, permissions, guards, and Next.js apps.',
}

export default function AuthzPage() {
  return <AuthzView />
}
