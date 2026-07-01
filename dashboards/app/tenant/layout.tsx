'use client';

import { DashboardLayout } from '../components/DashboardLayout';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
