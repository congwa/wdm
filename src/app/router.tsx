import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'

const Dashboard = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.Dashboard })))
const Embedding = lazy(() => import('@/pages/embedding').then(m => ({ default: m.Embedding })))
const CodeTracker = lazy(() => import('@/pages/code-tracker').then(m => ({ default: m.CodeTracker })))
const ChatHistory = lazy(() => import('@/pages/chat-history').then(m => ({ default: m.ChatHistory })))
const Account = lazy(() => import('@/pages/account').then(m => ({ default: m.Account })))
const Extensions = lazy(() => import('@/pages/extensions').then(m => ({ default: m.Extensions })))
const Workspaces = lazy(() => import('@/pages/workspaces').then(m => ({ default: m.Workspaces })))
const AIRules = lazy(() => import('@/pages/ai-rules').then(m => ({ default: m.AIRules })))
const Privacy = lazy(() => import('@/pages/privacy').then(m => ({ default: m.Privacy })))
const Cleanup = lazy(() => import('@/pages/cleanup').then(m => ({ default: m.Cleanup })))

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function suspense(element: React.ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: suspense(<Dashboard />) },
      { path: 'embedding', element: suspense(<Embedding />) },
      { path: 'code-tracker', element: suspense(<CodeTracker />) },
      { path: 'chat-history', element: suspense(<ChatHistory />) },
      { path: 'account', element: suspense(<Account />) },
      { path: 'extensions', element: suspense(<Extensions />) },
      { path: 'workspaces', element: suspense(<Workspaces />) },
      { path: 'ai-rules', element: suspense(<AIRules />) },
      { path: 'privacy', element: suspense(<Privacy />) },
      { path: 'cleanup', element: suspense(<Cleanup />) },
    ],
  },
])
