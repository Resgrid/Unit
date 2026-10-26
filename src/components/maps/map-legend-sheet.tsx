import { XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getMapIconLegend } from '@/api/mapping/mapping';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { type GetMapIconLegendResultData, type MapLegendPoiTypeData, type MapLegendRowData, type MapLegendStateData, type MapLegendStyleData } from '@/models/v4/mapping/getMapIconLegendResultData';
import { TermKeys, useTerm } from '@/stores/terminology/store';

import { PinMarkerIcon } from './pin-marker';
import { PoiMarkerGraphic } from './poi-marker';

/** The pin size the map draws calls, units, personnel, stations and hydrants at (`MapPins`). */
const PIN_SIZE = 32;
/** The width the map draws POI markers at (`MapPins`); the height follows the shape. */
const POI_SIZE = 36;
/** The server draws every station marker with this bundled image (it is not a department type). */
const STATION_IMAGE_PATH = 'Station';
/** The server draws every hydrant marker with this image name (it is not a department type). */
const HYDRANT_IMAGE_PATH = 'hydrant';

/** Translation keys of the style labels, by style `Key`. `unknown` is labelled per kind (status vs priority). */
const STYLE_LABEL_KEYS: Record<string, string> = {
  available: 'map.legend.style.available',
  dispatched: 'map.legend.style.dispatched',
  responding: 'map.legend.style.responding',
  onscene: 'map.legend.style.onscene',
  transporting: 'map.legend.style.transporting',
  returning: 'map.legend.style.returning',
  staging: 'map.legend.style.staging',
  delayed: 'map.legend.style.delayed',
  unavailable: 'map.legend.style.unavailable',
  low: 'map.legend.style.low',
  medium: 'map.legend.style.medium',
  high: 'map.legend.style.high',
  emergency: 'map.legend.style.emergency',
};

const UNKNOWN_STYLE_KEY = 'unknown';

/** The legend with every list present: the server may leave any list (or entry) out. */
export interface MapIconLegend {
  statusStyles: MapLegendStyleData[];
  priorityStyles: MapLegendStyleData[];
  calls: MapLegendRowData[];
  units: MapLegendRowData[];
  personnel: MapLegendRowData[];
  poiTypes: MapLegendPoiTypeData[];
}

const asList = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value.filter((item): item is T => item != null) : []);

const asNames = (value: string[] | null | undefined): string[] => asList(value).filter((name) => typeof name === 'string' && name.trim().length > 0);

/** The payload with absent lists (and null entries) treated as empty. */
export const normalizeMapIconLegend = (data: Partial<GetMapIconLegendResultData>): MapIconLegend => ({
  statusStyles: asList(data.StatusStyles),
  priorityStyles: asList(data.PriorityStyles),
  calls: asList(data.Calls),
  units: asList(data.Units),
  personnel: asList(data.Personnel),
  poiTypes: asList(data.PoiTypes),
});

const isHexColor = (color: string | null | undefined): color is string => typeof color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.trim());

/** The bundled pin of a list's "none" row (`Id` null): the default pin the map falls back to for that kind of marker. */
const getNoneRowImagePath = (rows: MapLegendRowData[]): string | null => rows.find((row) => row.Id == null)?.ImagePath ?? null;

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; legend: MapIconLegend };

interface LegendIconProps {
  label: string;
  iconUrl?: string | null;
  pinIconUrl?: string | null;
  imagePath?: string | null;
}

/** One legend icon, drawn exactly as the map draws the marker: upload > styled pin > bundled pin. */
const LegendIcon: React.FC<LegendIconProps> = React.memo(({ label, iconUrl, pinIconUrl, imagePath }) => (
  <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.iconBox}>
    <PinMarkerIcon iconUrl={iconUrl} pinIconUrl={pinIconUrl} imagePath={imagePath} size={PIN_SIZE} />
  </View>
));

LegendIcon.displayName = 'LegendIcon';

const ColorSwatch: React.FC<{ color: string | null | undefined }> = ({ color }) => (isHexColor(color) ? <View style={[styles.swatch, { backgroundColor: color.trim() }]} /> : <View style={styles.swatchPlaceholder} />);

const LegendSection: React.FC<{ title: string; note?: string; testID: string; children: React.ReactNode }> = ({ title, note, testID, children }) => (
  <VStack space="sm" className="mt-4" testID={testID}>
    <Heading size="sm" className="text-gray-900 dark:text-gray-100">
      {title}
    </Heading>
    {note ? <Text className="text-xs text-gray-500 dark:text-gray-400">{note}</Text> : null}
    {children}
  </VStack>
);

const NamesLine: React.FC<{ label: string; names: string[]; separator: string }> = ({ label, names, separator }) => {
  const { t } = useTranslation();
  return names.length > 0 ? <Text className="text-xs text-gray-600 dark:text-gray-400">{t('map.legend.name_list', { label, names: names.join(separator) })}</Text> : null;
};

interface LegendRowCardProps {
  row: MapLegendRowData;
  name: string;
  subtitle?: string;
}

/** A call type, unit type or role: its own icon and name, then the icon it shows in each of its priorities or statuses. */
const LegendRowCard: React.FC<LegendRowCardProps> = ({ row, name, subtitle }) => {
  const states = asList<MapLegendStateData>(row.States);

  return (
    <View className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <HStack space="sm" className="items-center">
        <LegendIcon label={name} iconUrl={row.IconUrl} pinIconUrl={row.PinIconUrl} imagePath={row.ImagePath} />
        <VStack className="flex-1">
          <Text className="font-semibold text-gray-900 dark:text-gray-100">{name}</Text>
          {subtitle ? <Text className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</Text> : null}
        </VStack>
      </HStack>
      {states.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap">
          {states.map((state, index) => (
            <HStack key={`${state.Id}-${index}`} space="xs" className="w-1/2 items-center py-1 pr-2 md:w-1/3">
              <LegendIcon label={`${name} · ${state.Name ?? ''}`} iconUrl={state.IconUrl} pinIconUrl={state.PinIconUrl} imagePath={state.ImagePath} />
              {isHexColor(state.Color) ? <View style={[styles.dot, { backgroundColor: state.Color.trim() }]} /> : null}
              <Text className="flex-1 text-sm text-gray-800 dark:text-gray-200" numberOfLines={2}>
                {state.Name ?? ''}
              </Text>
            </HStack>
          ))}
        </View>
      ) : null}
    </View>
  );
};

interface MapLegendSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** True when the map is drawing hydrants, so the legend shows the hydrant marker too. */
  showHydrants?: boolean;
}

/**
 * The map icon legend: what every icon on the department map means. Fetched from the server each time it opens, so
 * renamed or new call types, priorities, unit types, status sets, roles and uploaded icons show on the next open.
 * Icons are drawn by the map's own marker components.
 */
export const MapLegendSheet: React.FC<MapLegendSheetProps> = ({ isOpen, onClose, showHydrants = false }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by Retry to fetch again while the sheet stays open.
  const [attempt, setAttempt] = useState(0);

  const callsTitle = useTerm(TermKeys.Calls, t('map.legend.calls'));
  const unitsTitle = useTerm(TermKeys.Units, t('map.legend.units'));
  const personnelTitle = useTerm(TermKeys.Personnel, t('map.legend.personnel'));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    getMapIconLegend(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result?.Data) {
          throw new Error('The map icon legend response has no data');
        }
        setState({ status: 'loaded', legend: normalizeMapIconLegend(result.Data) });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        logger.warn({
          message: 'Failed to load the map icon legend',
          context: { error },
        });
        setState({ status: 'error' });
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, attempt]);

  const handleRetry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const getStyleLabel = (key: string | null | undefined, kind: 'status' | 'priority'): string => {
    const normalized = (key ?? '').trim().toLowerCase();
    if (normalized === UNKNOWN_STYLE_KEY) {
      return kind === 'priority' ? t('map.legend.priority_unknown') : t('map.legend.style.unknown');
    }
    const labelKey = STYLE_LABEL_KEYS[normalized];
    // A style added on the server after this build: show its key rather than nothing.
    return labelKey ? t(labelKey) : (key ?? '').trim();
  };

  const separator = t('map.legend.list_separator');

  const renderLegend = (legend: MapIconLegend) => {
    const defaultCallImage = getNoneRowImagePath(legend.calls);
    const defaultUnitImage = getNoneRowImagePath(legend.units);
    const defaultPersonImage = getNoneRowImagePath(legend.personnel);
    const prioritiesLabel = t('map.legend.priorities');

    return (
      <>
        {legend.statusStyles.length > 0 ? (
          <LegendSection title={t('map.legend.status_colors')} testID="map-legend-status-colors">
            {legend.statusStyles.map((style, index) => {
              const label = getStyleLabel(style.Key, 'status');
              return (
                <HStack key={`${style.Key}-${index}`} space="sm" className="items-center py-1">
                  <LegendIcon label={`${unitsTitle} · ${label}`} pinIconUrl={style.UnitPinIconUrl} imagePath={defaultUnitImage} />
                  <LegendIcon label={`${personnelTitle} · ${label}`} pinIconUrl={style.PersonPinIconUrl} imagePath={defaultPersonImage} />
                  <ColorSwatch color={style.Color} />
                  <VStack className="flex-1">
                    <Text className="font-semibold text-gray-900 dark:text-gray-100">{label}</Text>
                    <NamesLine label={unitsTitle} names={asNames(style.UnitStatuses)} separator={separator} />
                    <NamesLine label={personnelTitle} names={asNames(style.PersonnelStatuses)} separator={separator} />
                  </VStack>
                </HStack>
              );
            })}
          </LegendSection>
        ) : null}

        {legend.priorityStyles.length > 0 ? (
          <LegendSection title={t('map.legend.priority_colors')} testID="map-legend-priority-colors">
            {legend.priorityStyles.map((style, index) => {
              const label = getStyleLabel(style.Key, 'priority');
              return (
                <HStack key={`${style.Key}-${index}`} space="sm" className="items-center py-1">
                  <LegendIcon label={`${callsTitle} · ${label}`} pinIconUrl={style.CallPinIconUrl} imagePath={defaultCallImage} />
                  <ColorSwatch color={style.Color} />
                  <VStack className="flex-1">
                    <Text className="font-semibold text-gray-900 dark:text-gray-100">{label}</Text>
                    <NamesLine label={prioritiesLabel} names={asNames(style.Priorities)} separator={separator} />
                  </VStack>
                </HStack>
              );
            })}
          </LegendSection>
        ) : null}

        {legend.calls.length > 0 ? (
          <LegendSection title={callsTitle} testID="map-legend-calls">
            {legend.calls.map((row, index) => (
              <LegendRowCard key={`${row.Id ?? 'none'}-${index}`} row={row} name={row.Id == null ? t('map.legend.no_call_type') : (row.Name ?? '')} />
            ))}
          </LegendSection>
        ) : null}

        {legend.units.length > 0 ? (
          <LegendSection title={unitsTitle} testID="map-legend-units">
            {legend.units.map((row, index) => (
              <LegendRowCard
                key={`${row.Id ?? 'none'}-${index}`}
                row={row}
                name={row.Id == null ? t('map.legend.no_unit_type') : (row.Name ?? '')}
                subtitle={row.StatusSetName?.trim() ? t('map.legend.statuses', { name: row.StatusSetName.trim() }) : t('map.legend.built_in_unit_statuses')}
              />
            ))}
          </LegendSection>
        ) : null}

        {legend.personnel.length > 0 ? (
          <LegendSection title={personnelTitle} note={t('map.legend.personnel_note')} testID="map-legend-personnel">
            {legend.personnel.map((row, index) => (
              <LegendRowCard key={`${row.Id ?? 'none'}-${index}`} row={row} name={row.Id == null ? t('map.legend.no_role_icon') : (row.Name ?? '')} />
            ))}
          </LegendSection>
        ) : null}

        <LegendSection title={showHydrants ? t('map.legend.other_with_hydrants') : t('map.legend.other')} note={t('map.legend.other_note')} testID="map-legend-other">
          <HStack space="sm" className="items-center py-1">
            <LegendIcon label={t('map.legend.station')} imagePath={STATION_IMAGE_PATH} />
            <Text className="text-gray-900 dark:text-gray-100">{t('map.legend.station')}</Text>
          </HStack>
          {showHydrants ? (
            <HStack space="sm" className="items-center py-1">
              <LegendIcon label={t('map.legend.hydrant')} imagePath={HYDRANT_IMAGE_PATH} />
              <Text className="text-gray-900 dark:text-gray-100">{t('map.legend.hydrant')}</Text>
            </HStack>
          ) : null}
          {legend.poiTypes.map((poiType, index) => (
            <HStack key={`${poiType.PoiTypeId}-${index}`} space="sm" className="items-center py-1">
              <View accessible accessibilityRole="image" accessibilityLabel={poiType.Name} style={styles.poiBox}>
                <PoiMarkerGraphic poiImage={poiType.PoiImage} imagePath={poiType.ImagePath} color={poiType.Color} marker={poiType.Marker} iconUrl={poiType.IconUrl} size={POI_SIZE} />
              </View>
              <Text className="flex-1 text-gray-900 dark:text-gray-100">{poiType.Name}</Text>
            </HStack>
          ))}
        </LegendSection>
      </>
    );
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[88]} testID="map-legend-sheet">
      <VStack className="w-full pb-2">
        <HStack className="items-center justify-between">
          <Heading size="lg" className="flex-1 text-gray-900 dark:text-gray-100">
            {t('map.legend.title')}
          </Heading>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12} testID="map-legend-close">
            <XIcon size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
          </Pressable>
        </HStack>

        {state.status === 'loading' ? (
          <VStack space="sm" className="h-32 items-center justify-center" testID="map-legend-loading">
            <Spinner size="large" />
            <Text className="text-sm text-gray-500 dark:text-gray-400">{t('map.legend.loading')}</Text>
          </VStack>
        ) : null}

        {state.status === 'error' ? (
          <VStack space="md" className="items-center py-8" testID="map-legend-error">
            <Text className="text-center text-gray-700 dark:text-gray-300">{t('map.legend.error')}</Text>
            <Button onPress={handleRetry} variant="outline" testID="map-legend-retry">
              <ButtonText>{t('common.retry')}</ButtonText>
            </Button>
          </VStack>
        ) : null}

        {state.status === 'loaded' ? renderLegend(state.legend) : null}
      </VStack>
    </CustomBottomSheet>
  );
};

const styles = StyleSheet.create({
  iconBox: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiBox: {
    width: POI_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.25)',
  },
  swatchPlaceholder: {
    width: 16,
    height: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default MapLegendSheet;
