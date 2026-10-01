import React from 'react'
import { createRoot } from 'react-dom/client'
import DashboardLayout from '../../../app/(app)/dashboard/layout'
import SyntheticComparison from '../../../components/research/SyntheticComparison'
createRoot(document.getElementById('synthetic-root')!).render(
  <div className="pt-[100px] md:pt-[72px]">
    <DashboardLayout>
      <SyntheticComparison />
    </DashboardLayout>
  </div>,
)
