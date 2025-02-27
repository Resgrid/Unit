import * as React from 'react';
import { Text } from '@/components/ui/text';
import { useCoreStore } from '@/stores/app/core-store';
import { Card } from '../ui/card';

type ItemProps = {
  unitName: string;
  unitType: string;
  unitGroup: string;
  bgColor: string;
};

export const SidebarUnitCard = ({
  unitName: defaultUnitName,
  unitType: defaultUnitType,
  unitGroup: defaultUnitGroup,
  bgColor,
}: ItemProps) => {
  const activeUnit = useCoreStore((state) => state.activeUnit);

  // Derive the display values from activeUnit when available, otherwise use defaults
  const displayName = activeUnit?.Name ?? defaultUnitName;
  const displayType = activeUnit?.Type ?? defaultUnitType;
  const displayGroup = activeUnit?.GroupName ?? defaultUnitGroup;

  return (
    <Card className={`flex-1 ${bgColor}`}>
      <Text className="text-sm text-gray-500">{displayType}</Text>
      <Text className="font-medium">{displayName}</Text>
      <Text className="text-sm text-gray-500">{displayGroup}</Text>
    </Card>
  );
};
