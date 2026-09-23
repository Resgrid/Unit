import { type Href, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { OptionSelect } from '@/components/operations/option-select';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { contentOf, groupEquipment, locationNames, orderLocations } from '@/lib/inventory/count';
import { InventoryAssetStatus, InventoryCountStatus } from '@/models/v4/inventory';
import { useCoreStore } from '@/stores/app/core-store';
import { useInventoryStore } from '@/stores/inventory/store';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// What the active unit carries, compartment by compartment, and the inventory counts the crew runs against
// it. Starting a count needs Adjust Inventory at the unit (a department permission); viewing does not.
export default function UnitInventoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const { access, equipment, counts, busy, error } = useInventoryStore();
  const [countLocation, setCountLocation] = useState('');
  const unitId = activeUnitId ? Number(activeUnitId) : null;

  useFocusEffect(
    useCallback(() => {
      if (unitId) void useInventoryStore.getState().load(unitId);
    }, [unitId])
  );

  const locations = useMemo(() => orderLocations(access?.UnitLocations ?? []), [access]);
  const names = useMemo(() => locationNames(locations, t('inventory.unnamedLocation')), [locations, t]);
  const groups = useMemo(() => groupEquipment(equipment, t('inventory.unnamedItem')), [equipment, t]);
  const root = locations.find((location) => location.IsRoot);
  const selected = countLocation || root?.Id || '';
  const writable = !!access?.Enabled && !!access.Migrated;

  const start = async () => {
    if (!selected) return;
    const label = selected === root?.Id ? activeUnit?.Name || names[selected] : names[selected];
    const id = await useInventoryStore.getState().start(selected, t('inventory.countName', { name: label, date: todayKey() }));
    if (id) router.push(`/inventory/count/${id}` as Href);
  };

  return (
    <VStack className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: t('inventory.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => unitId && void useInventoryStore.getState().load(unitId)} />}>
        <Text className="text-xl font-bold">{activeUnit?.Name ? t('inventory.titleFor', { name: activeUnit.Name }) : t('inventory.title')}</Text>
        {!unitId ? <Text className="text-typography-500">{t('inventory.selectUnit')}</Text> : null}
        {busy && !access ? <Spinner /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-error-600">
            {t(`inventory.errors.${error}`, { defaultValue: t('inventory.errors.retry') })}
          </Text>
        ) : null}
        {access && !writable ? <Text className="text-typography-500">{access.Enabled ? t('inventory.notMigrated') : t('inventory.disabled')}</Text> : null}
        {access && locations.length === 0 ? <Text className="text-typography-500">{t('inventory.noLocations')}</Text> : null}

        {access?.CanCount && writable && locations.length > 0 ? (
          <VStack space="sm" className="rounded-lg border border-outline-200 p-3" testID="inventory-start-count">
            <Text className="font-semibold">{t('inventory.startCount')}</Text>
            {locations.length > 1 ? (
              <OptionSelect
                value={selected}
                options={locations.map((location) => ({ value: location.Id, label: location.IsRoot ? t('inventory.wholeUnit', { name: activeUnit?.Name || names[location.Id] }) : names[location.Id] }))}
                placeholder={t('inventory.pickLocation')}
                onChange={setCountLocation}
                testID="inventory-count-location"
              />
            ) : null}
            <Text className="text-typography-500">{t('inventory.startHelp')}</Text>
            <Button onPress={() => void start()} isDisabled={busy || !selected} testID="inventory-start">
              <ButtonText>{t('inventory.start')}</ButtonText>
            </Button>
          </VStack>
        ) : null}
        {access && !access.CanCount && locations.length > 0 ? <Text className="text-typography-500">{t('inventory.cannotCount')}</Text> : null}

        {counts.length > 0 ? (
          <VStack space="xs">
            <Text className="font-semibold">{t('inventory.counts')}</Text>
            {counts.slice(0, 10).map((count) => (
              <Pressable key={count.Id} onPress={() => router.push(`/inventory/count/${count.Id}` as Href)} testID={`inventory-count-${count.Id}`} className="rounded-lg border border-outline-200 p-2">
                <HStack className="items-center justify-between">
                  <Text className="flex-1">{contentOf(count.Content).Name || t('inventory.count')}</Text>
                  <Text className={count.Status === InventoryCountStatus.Draft ? 'text-primary-600' : 'text-typography-500'}>{t(`inventory.countStatus.${count.Status}`)}</Text>
                </HStack>
                <Text className="text-typography-500">
                  {String(count.CompletedOn ?? count.SnapshotOn ?? '')
                    .slice(0, 16)
                    .replace('T', ' ')}
                </Text>
              </Pressable>
            ))}
          </VStack>
        ) : null}

        {locations.map((location) => (
          <VStack key={location.Id} space="xs" testID={`inventory-location-${location.Id}`}>
            <Text className="font-semibold">{location.IsRoot ? activeUnit?.Name || names[location.Id] : names[location.Id]}</Text>
            {(groups[location.Id] ?? []).length === 0 ? <Text className="text-typography-500">{t('inventory.empty')}</Text> : null}
            {(groups[location.Id] ?? []).map((row) => (
              <HStack key={row.key} className="items-center justify-between border-b border-outline-100 py-1">
                <VStack className="flex-1">
                  <Text>{row.name}</Text>
                  {row.serial ? <Text className="text-typography-500">{t('inventory.serial', { serial: row.serial })}</Text> : null}
                </VStack>
                <Text className={row.assetStatus != null && row.assetStatus !== InventoryAssetStatus.InService && row.assetStatus !== InventoryAssetStatus.Issued ? 'text-warning-600' : 'text-typography-600'}>
                  {row.assetStatus != null ? t(`inventory.assetStatus.${row.assetStatus}`) : t('inventory.quantity', { quantity: row.quantity })}
                </Text>
              </HStack>
            ))}
          </VStack>
        ))}
      </ScrollView>
    </VStack>
  );
}
