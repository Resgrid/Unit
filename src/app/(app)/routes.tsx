import React from 'react';

import { RoutesHome } from '@/components/routes/routes-home';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';

export default function Routes() {
  return (
    <>
      <FocusAwareStatusBar />
      <RoutesHome />
    </>
  );
}
