import React from 'react';
import { View } from 'react-native';

import { ActiveRoutesList } from '@/components/routes/active-routes-list';
import { PoiListContent } from '@/components/routes/poi-list-content';
import { Box } from '@/components/ui/box';
import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';

export const RoutesHome: React.FC = () => {
  const tabs = React.useMemo<TabItem[]>(
    () => [
      {
        key: 'routes',
        title: 'routes.routes_tab',
        content: <ActiveRoutesList />,
      },
      {
        key: 'pois',
        title: 'routes.pois_tab',
        content: <PoiListContent />,
      },
    ],
    []
  );

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <Box className="flex-1 px-4 pt-4">
        <SharedTabs tabs={tabs} scrollable={false} variant="segmented" contentClassName="pt-4" />
      </Box>
    </View>
  );
};
