import React from 'react';

import { Box } from '@/components/ui/box';

// Import from sidebar-content directly to avoid require cycle.
// On web, './sidebar' resolves to sidebar.web.tsx (this file), not sidebar.tsx.
import Sidebar from './sidebar-content';

const WebSidebar = () => {
  return (
    <Box className="w-full flex-1 md:web:max-h-[calc(100vh-144px)]">
      {/* common sidebar contents for web and mobile */}
      <Sidebar />
    </Box>
  );
};
export default WebSidebar;
