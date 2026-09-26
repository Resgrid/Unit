import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Minus, Plus } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { clampQuantity, contentOf, isComplete, locationNames, observedQuantity, orderLocations, variances } from '@/lib/inventory/count';
import type { InventoryCountLine } from '@/models/v4/inventory';
import { InventoryCountStatus } from '@/models/v4/inventory';
import { useCoreStore } from '@/stores/app/core-store';
import { useInventoryStore } from '@/stores/inventory/store';

// One inventory count of the unit: every stock position and serialized item the unit is expected to carry,
// compartment by compartment. The crew enters what is actually there; completing posts the differences to
// the ledger (a missing serialized item becomes Lost). Controlled items wait for a witness on the web.
export default function InventoryCountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const { access, count, observed, busy, error, awaitingWitness } = useInventoryStore();

  useFocusEffect(
    useCallback(() => {
      if (id && useInventoryStore.getState().count?.Count.Id !== id) void useInventoryStore.getState().open(id);
      return undefined;
    }, [id])
  );

  const names = useMemo(() => locationNames(access?.UnitLocations ?? [], t('inventory.unnamedLocation')), [access, t]);
  const order = useMemo(() => orderLocations(access?.UnitLocations ?? []).map((location) => location.Id), [access]);
  const grouped = useMemo(() => {
    const groups: Record<string, InventoryCountLine[]> = {};
    (count?.Lines ?? []).forEach((line) => (groups[line.LocationId] ??= []).push(line));
    Object.values(groups).forEach((lines) => lines.sort((a, b) => (contentOf(a.Content).ItemName ?? '').localeCompare(contentOf(b.Content).ItemName ?? '')));
    return Object.entries(groups).sort(([a], [b]) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)));
  }, [count, order]);

  const locationLabel = (locationId: string) => {
    const location = access?.UnitLocations.find((candidate) => candidate.Id === locationId);
    return location?.IsRoot ? activeUnit?.Name || names[locationId] : (names[locationId] ?? t('inventory.unnamedLocation'));
  };
  const lines = count?.Lines ?? [];
  const editable = count?.Count.Status === InventoryCountStatus.Draft;
  const counted = lines.filter((line) => observedQuantity(line, observed) != null).length;
  const differences = variances(lines, observed);
  const set = (line: InventoryCountLine, value: number) => useInventoryStore.getState().setObserved(line.Id, clampQuantity(line, value));

  const complete = () =>
    Alert.alert(t('inventory.completeTitle'), differences.length > 0 ? t('inventory.completeBody', { count: differences.length }) : t('inventory.completeNoChanges'), [
      { text: t('inventory.cancel'), style: 'cancel' },
      { text: t('inventory.complete'), onPress: () => void useInventoryStore.getState().complete() },
    ]);

  const cancel = () =>
    Alert.alert(t('inventory.cancelTitle'), t('inventory.cancelBody'), [
      { text: t('inventory.keep'), style: 'cancel' },
      {
        text: t('inventory.cancelCount'),
        style: 'destructive',
        onPress: async () => {
          if (await useInventoryStore.getState().cancel()) router.back();
        },
      },
    ]);

  return (
    <VStack className="flex-1 bg-background-0">
      <Stack.Screen options={{ title: t('inventory.count') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <HStack space="sm" className="items-center">
          <Pressable onPress={() => router.back()} testID="inventory-count-back" accessibilityRole="button" accessibilityLabel={t('inventory.back')}>
            <ArrowLeft size={22} color="#2563eb" />
          </Pressable>
          <Text className="flex-1 text-xl font-bold">{contentOf(count?.Count.Content).Name || t('inventory.count')}</Text>
        </HStack>
        {busy && !count ? <Spinner /> : null}
        {error ? (
          <Text accessibilityRole="alert" className="text-error-600">
            {t(`inventory.errors.${error}`, { defaultValue: t('inventory.errors.retry') })}
          </Text>
        ) : null}
        {count ? (
          <Text className="text-typography-500">
            {t(`inventory.countStatus.${count.Count.Status}`)} · {t('inventory.progress', { counted, total: lines.length })} · {t('inventory.differences', { count: differences.length })}
          </Text>
        ) : null}
        {awaitingWitness ? <Text className="text-warning-600">{t('inventory.awaitingWitness')}</Text> : null}
        {count?.Count.Status === InventoryCountStatus.Completed ? <Text className="text-success-600">{t('inventory.completed')}</Text> : null}

        {grouped.map(([locationId, rows]) => (
          <VStack key={locationId} space="xs">
            <Text className="font-semibold">{locationLabel(locationId)}</Text>
            {rows.map((line) => {
              const details = contentOf(line.Content);
              const value = observedQuantity(line, observed);
              const differs = value != null && value !== line.ExpectedQuantity;
              return (
                <VStack key={line.Id} space="xs" className={`rounded-lg border p-2 ${differs ? 'border-warning-500' : 'border-outline-200'}`} testID={`inventory-line-${line.Id}`}>
                  <Text>{details.ItemName || t('inventory.unnamedItem')}</Text>
                  {details.SerialNumber || details.LotNumber ? <Text className="text-typography-500">{[details.SerialNumber, details.LotNumber].filter(Boolean).join(' · ')}</Text> : null}
                  <Text className="text-typography-500">{t('inventory.expected', { quantity: line.ExpectedQuantity, unit: details.UnitOfMeasure ?? '' })}</Text>
                  {line.AssetId ? (
                    <HStack space="sm">
                      <Button size="sm" variant={value === 1 ? 'solid' : 'outline'} onPress={() => set(line, 1)} isDisabled={!editable} testID={`inventory-present-${line.Id}`}>
                        <ButtonText>{t('inventory.present')}</ButtonText>
                      </Button>
                      <Button size="sm" action="negative" variant={value === 0 ? 'solid' : 'outline'} onPress={() => set(line, 0)} isDisabled={!editable} testID={`inventory-missing-${line.Id}`}>
                        <ButtonText>{t('inventory.missing')}</ButtonText>
                      </Button>
                    </HStack>
                  ) : (
                    <HStack space="sm" className="items-center">
                      <Pressable
                        onPress={() => set(line, (value ?? line.ExpectedQuantity) - 1)}
                        disabled={!editable}
                        accessibilityRole="button"
                        accessibilityLabel={t('inventory.less')}
                        testID={`inventory-less-${line.Id}`}
                      >
                        <Minus size={22} color="#2563eb" />
                      </Pressable>
                      <Input className="w-24" isDisabled={!editable}>
                        <InputField
                          value={value == null ? '' : String(value)}
                          placeholder={String(line.ExpectedQuantity)}
                          keyboardType="decimal-pad"
                          onChangeText={(text) => (text.trim() === '' ? undefined : set(line, Number(text.replace(',', '.'))))}
                          testID={`inventory-quantity-${line.Id}`}
                        />
                      </Input>
                      <Pressable
                        onPress={() => set(line, (value ?? line.ExpectedQuantity) + 1)}
                        disabled={!editable}
                        accessibilityRole="button"
                        accessibilityLabel={t('inventory.more')}
                        testID={`inventory-more-${line.Id}`}
                      >
                        <Plus size={22} color="#2563eb" />
                      </Pressable>
                      <Button size="sm" variant="link" onPress={() => set(line, line.ExpectedQuantity)} isDisabled={!editable} testID={`inventory-matches-${line.Id}`}>
                        <ButtonText>{t('inventory.matches')}</ButtonText>
                      </Button>
                    </HStack>
                  )}
                </VStack>
              );
            })}
          </VStack>
        ))}

        {editable ? (
          <VStack space="sm">
            <Button variant="outline" onPress={() => void useInventoryStore.getState().save()} isDisabled={busy || Object.keys(observed).length === 0} testID="inventory-save">
              <ButtonText>{t('inventory.save')}</ButtonText>
            </Button>
            <Button action="positive" onPress={complete} isDisabled={busy || !isComplete(lines, observed)} testID="inventory-complete">
              <ButtonText>{t('inventory.complete')}</ButtonText>
            </Button>
            <Button variant="link" action="negative" onPress={cancel} isDisabled={busy} testID="inventory-cancel">
              <ButtonText>{t('inventory.cancelCount')}</ButtonText>
            </Button>
          </VStack>
        ) : null}
      </ScrollView>
    </VStack>
  );
}
