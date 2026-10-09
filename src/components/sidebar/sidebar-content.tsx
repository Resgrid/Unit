import { useRouter } from 'expo-router';
import { Briefcase, FileText, MessagesSquare, Package, Settings, Sparkles } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { CurrentStatusRing } from '@/components/status/current-status-ring';
import { HoldToConfirmButton } from '@/components/status/hold-to-confirm-button';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getOfferedStatuses, resolveCurrentStatusId } from '@/lib/status-flow';
import { readableColors } from '@/lib/utils';
import { useCoreStore } from '@/stores/app/core-store';
import { useIsChatEnabled, useIsChecklistsEnabled, useIsDeploymentsEnabled, useIsRecordsFieldEnabled } from '@/stores/feature-flags/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { useToastStore } from '@/stores/toast/store';

import ZeroState from '../common/zero-state';
import { SidebarCallCard } from './call-sidebar';
import { CheckInSidebarWidget } from './check-in-sidebar-widget';
import { SidebarRolesCard } from './roles-sidebar';
import { SidebarStatusCard } from './status-sidebar';
import { SidebarUnitCard } from './unit-sidebar';

/** Corner radii of the two status button kinds (gluestack `rounded`, HoldToConfirmButton), for the current-status ring. */
const BUTTON_RADIUS = 4;
const HOLD_BUTTON_RADIUS = 8;

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
  const activeStatuses = useCoreStore((state) => state.activeStatuses);
  const activeUnitStatus = useCoreStore((state) => state.activeUnitStatus);
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const isHoldMode = useCoreStore((state) => state.config?.StatusHoldToConfirm === true);
  const setIsOpen = useStatusBottomSheetStore((state) => state.setIsOpen);
  const showToast = useToastStore((state) => state.showToast);
  const [showAllStatuses, setShowAllStatuses] = React.useState(false);
  const isChatEnabled = useIsChatEnabled();
  const isChecklistsEnabled = useIsChecklistsEnabled();
  const isDeploymentsEnabled = useIsDeploymentsEnabled();
  const hasActiveUnit = !!useCoreStore((state) => state.activeUnitId);
  const isRecordsEnabled = useIsRecordsFieldEnabled();
  const { t } = useTranslation();
  const router = useRouter();

  const isActiveStatusesEmpty = !activeStatuses?.Statuses || activeStatuses.Statuses.length === 0;

  // Same status flow as the status sheet: the current status is ringed, and a status with next statuses
  // configured narrows the buttons to those until the crew asks for all of them.
  const currentStatusId = React.useMemo(() => {
    if (!activeUnitStatus || (activeUnitId && activeUnitStatus.UnitId && String(activeUnitStatus.UnitId) !== String(activeUnitId))) {
      return null;
    }

    return resolveCurrentStatusId(activeStatuses?.Statuses, activeUnitStatus);
  }, [activeStatuses?.Statuses, activeUnitId, activeUnitStatus]);
  const offeredStatuses = React.useMemo(() => getOfferedStatuses(activeStatuses?.Statuses, currentStatusId, showAllStatuses), [activeStatuses?.Statuses, currentStatusId, showAllStatuses]);
  const hasNextStatusRestriction = React.useMemo(() => showAllStatuses && getOfferedStatuses(activeStatuses?.Statuses, currentStatusId, false).isRestricted, [activeStatuses?.Statuses, currentStatusId, showAllStatuses]);

  // A new status brings its own next statuses; go back to the narrowed list.
  React.useEffect(() => {
    setShowAllStatuses(false);
  }, [currentStatusId]);

  const handleNavigateToSettings = () => {
    onClose?.();
    router.push('/settings');
  };

  const handleNavigateToChat = () => {
    onClose?.();
    router.push('/chat');
  };

  const handleNavigateToRecords = () => {
    onClose?.();
    router.push('/records');
  };

  const handleNavigateToAssistant = () => {
    onClose?.();
    router.push('/chatbot');
  };

  return (
    <ScrollView className="size-full pt-4" contentContainerStyle={{ flexGrow: 1 }}>
      <VStack space="md" className="w-full flex-1 p-2">
        {/* First row - Two cards side by side */}
        <HStack space="md">
          <SidebarUnitCard unitName={t('common.no_unit')} unitType="" unitGroup={t('common.no_unit_selected')} bgColor="bg-background-50" />
          <VStack space="xs" className="flex-1">
            <SidebarStatusCard />
            <SidebarRolesCard />
          </VStack>
        </HStack>

        {/* Second row - Single card */}
        <SidebarCallCard />

        {/* Check-in timer widget */}
        <CheckInSidebarWidget />

        {/* Chat + Assistant navigation (hidden when the Chat.System feature flag is off) */}
        {isChatEnabled ? (
          <HStack space="md">
            <Button variant="outline" action="secondary" size="md" className="flex-1" onPress={handleNavigateToChat}>
              <MessagesSquare size={18} color="#2563eb" />
              <ButtonText className="ml-2">{t('tabs.chat')}</ButtonText>
            </Button>
            <Button variant="outline" action="secondary" size="md" className="flex-1" onPress={handleNavigateToAssistant}>
              <Sparkles size={18} color="#7c3aed" />
              <ButtonText className="ml-2">{t('tabs.assistant')}</ButtonText>
            </Button>
          </HStack>
        ) : null}

        {isChecklistsEnabled ? (
          <Button
            variant="outline"
            onPress={() => {
              onClose?.();
              router.push('/checklists');
            }}
            testID="sidebar-checklists"
          >
            <ButtonText>{t('checklists.labels.Checklists')}</ButtonText>
          </Button>
        ) : null}

        {/* Deployments / daily time reports (hidden until Operations.Deployments is on) */}
        {isDeploymentsEnabled ? (
          <Button
            variant="outline"
            action="secondary"
            size="md"
            onPress={() => {
              onClose?.();
              router.push('/operations');
            }}
            testID="sidebar-operations"
          >
            <Briefcase size={18} color="#2563eb" />
            <ButtonText className="ml-2">{t('operations.title')}</ButtonText>
          </Button>
        ) : null}

        {/* The active unit's inventory: what it carries and the counts the crew runs (needs an active unit) */}
        {hasActiveUnit ? (
          <Button
            variant="outline"
            action="secondary"
            size="md"
            onPress={() => {
              onClose?.();
              router.push('/inventory');
            }}
            testID="sidebar-inventory"
          >
            <Package size={18} color="#2563eb" />
            <ButtonText className="ml-2">{t('inventory.title')}</ButtonText>
          </Button>
        ) : null}

        {/* Field Records (hidden until Records.System and this app's child flag are both on) */}
        {isRecordsEnabled ? (
          <Button variant="outline" action="secondary" size="md" onPress={handleNavigateToRecords} testID="sidebar-records">
            <FileText size={18} color="#2563eb" />
            <ButtonText className="ml-2">{t('tabs.records')}</ButtonText>
          </Button>
        ) : null}

        {/* Third row - Status buttons or empty state */}
        {isActiveStatusesEmpty ? (
          <ZeroState
            icon={Settings}
            iconSize={60}
            iconColor="#64748b"
            heading={t('common.noActiveUnit')}
            description={t('common.noActiveUnitDescription')}
            className="mt-0"
            viewClassName="w-full flex-1 px-6 pb-6 pt-0"
            centerClassName="flex-1 p-6"
          >
            <Button variant="solid" action="primary" size="md" onPress={handleNavigateToSettings} className="mt-0">
              <ButtonText>{t('settings.title')}</ButtonText>
            </Button>
          </ZeroState>
        ) : (
          <VStack space="sm" className="mb-4 w-full">
            {offeredStatuses.offered.map((status) => {
              const isCurrent = String(status.Id) === currentStatusId;
              // An option without a color falls back to white like the status sheet.
              const { backgroundColor: background, textColor: foreground } = readableColors(status.BColor, '#ffffff');
              const label = (
                <ButtonText numberOfLines={1} style={[styles.labelText, { color: foreground }]}>
                  {status.Text}
                </ButtonText>
              );
              const accessibilityLabel = isCurrent ? `${status.Text}, ${t('status.current')}` : undefined;

              const button = isHoldMode ? (
                <HoldToConfirmButton
                  key={status.Id}
                  testID={`sidebar-status-hold-${status.Id}`}
                  onConfirm={() => setIsOpen(true, status, { holdConfirmed: true })}
                  onTap={() => showToast('info', t('status.hold_to_set_hint'))}
                  backgroundColor={background}
                  foregroundColor={foreground}
                  contentStyle={styles.holdContent}
                  accessibilityLabel={accessibilityLabel ?? status.Text}
                  accessibilityHint={t('status.hold_to_set_hint')}
                >
                  {label}
                </HoldToConfirmButton>
              ) : (
                <Button
                  key={status.Id}
                  testID={`sidebar-status-${status.Id}`}
                  variant="solid"
                  className="w-full justify-center overflow-visible px-3 py-2"
                  action="primary"
                  size="lg"
                  style={{ backgroundColor: background }}
                  onPress={() => setIsOpen(true, status)}
                  accessibilityLabel={accessibilityLabel}
                >
                  {label}
                </Button>
              );

              return isCurrent ? (
                <View key={status.Id}>
                  <CurrentStatusRing radius={isHoldMode ? HOLD_BUTTON_RADIUS : BUTTON_RADIUS} testID={`sidebar-status-current-ring-${status.Id}`} />
                  {button}
                </View>
              ) : (
                button
              );
            })}

            {offeredStatuses.isRestricted ? (
              <TouchableOpacity testID="sidebar-status-show-all" onPress={() => setShowAllStatuses(true)} className="items-center py-1">
                <Text className="font-semibold text-blue-600 dark:text-blue-400">{t('status.show_all_statuses', { count: offeredStatuses.hiddenCount })}</Text>
              </TouchableOpacity>
            ) : hasNextStatusRestriction ? (
              <TouchableOpacity testID="sidebar-status-show-next" onPress={() => setShowAllStatuses(false)} className="items-center py-1">
                <Text className="font-semibold text-blue-600 dark:text-blue-400">{t('status.show_next_statuses')}</Text>
              </TouchableOpacity>
            ) : null}
          </VStack>
        )}
      </VStack>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  labelText: {
    flexShrink: 1,
    textAlign: 'center',
  },
  holdContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

export default Sidebar;
