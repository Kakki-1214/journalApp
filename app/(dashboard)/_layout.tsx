import React from 'react';
import { Slot } from 'expo-router';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardGroupLayout() {
  return (
    <DashboardLayout>
      <Slot />
    </DashboardLayout>
  );
}
