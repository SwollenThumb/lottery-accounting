import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { BankCards } from '@/pages/BankCards'
import { LotteryInventory } from '@/pages/LotteryInventory'
import { SalesRecordPage } from '@/pages/SalesRecord'
import { Reconciliation } from '@/pages/Reconciliation'
import { ShopManagement } from '@/pages/ShopManagement'
import { EquipmentManagement } from '@/pages/EquipmentManagement'
import { UserManagement } from '@/pages/UserManagement'
import { Settlement } from '@/pages/Settlement'
import { ClosureSettlement } from '@/pages/ClosureSettlement'
import { StaffSubmissionPage } from '@/pages/StaffSubmission'
import { FinanceReviewPage } from '@/pages/FinanceReview'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="bank-cards" element={<BankCards />} />
              <Route path="inventory" element={<LotteryInventory />} />
              <Route path="sales" element={<SalesRecordPage />} />
              <Route path="reconciliation" element={<Reconciliation />} />
              <Route path="shops" element={<ProtectedRoute roles={['super_admin']}><ShopManagement /></ProtectedRoute>} />
              <Route path="equipment" element={<ProtectedRoute roles={['super_admin']}><EquipmentManagement /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute roles={['super_admin', 'admin']}><UserManagement /></ProtectedRoute>} />
              <Route path="settlement" element={<ProtectedRoute roles={['super_admin', 'admin']}><Settlement /></ProtectedRoute>} />
              <Route path="closure" element={<ProtectedRoute roles={['super_admin']}><ClosureSettlement /></ProtectedRoute>} />
              <Route path="submissions" element={<ProtectedRoute roles={['super_admin', 'admin', 'finance', 'staff']}><StaffSubmissionPage /></ProtectedRoute>} />
              <Route path="finance-review" element={<ProtectedRoute roles={['super_admin', 'admin', 'finance']}><FinanceReviewPage /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
