import { format } from 'date-fns';
import { MailIcon, MessageCircle, PhoneIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useDirectMessage } from '@/hooks/use-direct-message';
import { logger } from '@/lib/logging';
import { type IncidentContactInfo, IncidentNeedStatus, type TacticalObjective, TacticalObjectiveStatus } from '@/models/v4/incidentCommand/resourceIncidentView';
import { useIncidentCommandStore } from '@/stores/calls/incident-command-store';

import { IncidentChatSection } from './incident-chat-section';

interface IncidentCommandTabPanelProps {
  callId: string;
}

const OBJECTIVE_TYPE_KEYS: Record<number, string> = {
  0: 'general',
  1: 'benchmark',
  2: 'safety',
};

const OBJECTIVE_STATUS_KEYS: Record<number, string> = {
  0: 'pending',
  1: 'complete',
  2: 'in_progress',
};

const NEED_CATEGORY_KEYS: Record<number, string> = {
  0: 'resource',
  1: 'logistics',
  2: 'medical',
  3: 'equipment',
  4: 'staffing',
  5: 'other',
};

const NEED_STATUS_KEYS: Record<number, string> = {
  0: 'open',
  1: 'partially_met',
  2: 'met',
  3: 'cancelled',
};

type BadgeAction = 'error' | 'warning' | 'success' | 'info' | 'muted';

const getObjectiveStatusAction = (status: number): BadgeAction => {
  if (status === TacticalObjectiveStatus.Complete) return 'success';
  if (status === TacticalObjectiveStatus.InProgress) return 'warning';
  return 'muted';
};

const getNeedStatusAction = (status: number): BadgeAction => {
  if (status === IncidentNeedStatus.Met) return 'success';
  if (status === IncidentNeedStatus.PartiallyMet) return 'warning';
  if (status === IncidentNeedStatus.Cancelled) return 'muted';
  return 'info';
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return format(date, 'MMM d, h:mm a');
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const openContactUrl = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch (error) {
    // The URL embeds a phone number or email address (PII) — log only the scheme,
    // and strip the URL from the platform error message, which repeats it.
    const scheme = url.split(':')[0];
    logger.error({
      message: 'Failed to open contact link',
      context: {
        scheme,
        error: error instanceof Error ? error.message.replaceAll(url, `${scheme}:<redacted>`) : String(error),
      },
    });
  }
};

interface ContactRowProps {
  label: string;
  contact: IncidentContactInfo;
  testID: string;
}

const ContactRow: React.FC<ContactRowProps> = ({ label, contact, testID }) => {
  const { t } = useTranslation();
  const { openDirectMessage } = useDirectMessage();

  return (
    <Box className="border-b border-outline-100 pb-2" testID={testID}>
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="font-medium">{contact.Name}</Text>
      {contact.Phone ? (
        <Pressable onPress={() => openContactUrl(`tel:${contact.Phone}`)} testID={`${testID}-phone`}>
          <HStack className="mt-1 items-center">
            <PhoneIcon size={14} color="#3B82F6" />
            <Text className="ml-1 text-sm text-blue-500">{contact.Phone}</Text>
          </HStack>
        </Pressable>
      ) : null}
      {contact.Email ? (
        <Pressable onPress={() => openContactUrl(`mailto:${contact.Email}`)} testID={`${testID}-email`}>
          <HStack className="mt-1 items-center">
            <MailIcon size={14} color="#3B82F6" />
            <Text className="ml-1 text-sm text-blue-500">{contact.Email}</Text>
          </HStack>
        </Pressable>
      ) : null}
      {/* External contacts carry a name and phone but no Resgrid account, so there is nobody to message. */}
      {contact.UserId ? (
        <Pressable onPress={() => void openDirectMessage(contact.UserId)} testID={`${testID}-message`}>
          <HStack className="mt-1 items-center">
            <MessageCircle size={14} color="#3B82F6" />
            <Text className="ml-1 text-sm text-blue-500">{t('incident_command.send_message')}</Text>
          </HStack>
        </Pressable>
      ) : null}
    </Box>
  );
};

interface LaneObjectiveRowProps {
  label: string;
  objective: TacticalObjective;
  progressText: string;
  testID: string;
}

const LaneObjectiveRow: React.FC<LaneObjectiveRowProps> = ({ label, objective, progressText, testID }) => {
  return (
    <Box className="border-b border-outline-100 pb-2" testID={testID}>
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="font-medium">{objective.Name}</Text>
      <Text className="text-sm text-gray-500">{progressText}</Text>
    </Box>
  );
};

export const IncidentCommandTabPanel: React.FC<IncidentCommandTabPanelProps> = ({ callId }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const view = useIncidentCommandStore((state) => state.view);
  const isLoading = useIncidentCommandStore((state) => state.isLoading);
  const error = useIncidentCommandStore((state) => state.error);
  const fetchIncidentView = useIncidentCommandStore((state) => state.fetchIncidentView);

  useEffect(() => {
    if (callId) {
      fetchIncidentView(callId);
    }
  }, [callId, fetchIncidentView]);

  const cardClass = colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-neutral-100';

  if (isLoading) {
    return (
      <Box className="items-center justify-center p-8" testID="incident-command-loading">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="p-4" testID="incident-command-error">
        <Text className="text-center text-red-500">{t('incident_command.error')}</Text>
      </Box>
    );
  }

  if (!view) {
    return (
      <Box className="p-4" testID="incident-command-empty">
        <Text className="text-center text-gray-500">{t('incident_command.no_active_command')}</Text>
      </Box>
    );
  }

  const assignment = view.MyAssignment;
  const notes = view.Notes.filter((note) => !note.DeletedOn);
  const attachments = view.Attachments.filter((attachment) => !attachment.DeletedOn);

  return (
    <VStack className="p-4" space="md" testID="incident-command-tab-panel">
      {/* Unit assignment card */}
      {assignment ? (
        <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-assignment-card">
          <Heading size="sm">{t('incident_command.my_assignment')}</Heading>
          <HStack className="mt-2 items-center">
            <Box className="mr-2 size-3 rounded-full" style={{ backgroundColor: assignment.Color || '#6B7280' }} testID="incident-command-lane-color" />
            <Text className="font-semibold" testID="incident-command-lane-name">
              {assignment.LaneName}
            </Text>
          </HStack>
          <Text className="mb-2 text-sm text-gray-500">{t('incident_command.assigned_since', { time: formatDateTime(assignment.AssignedOn) })}</Text>
          <VStack className="space-y-3">
            {assignment.PrimaryLead ? <ContactRow label={t('incident_command.primary_lead')} contact={assignment.PrimaryLead} testID="incident-command-primary-lead" /> : null}
            {assignment.SecondaryLead ? <ContactRow label={t('incident_command.secondary_lead')} contact={assignment.SecondaryLead} testID="incident-command-secondary-lead" /> : null}
            {assignment.PrimaryObjective ? (
              <LaneObjectiveRow
                label={t('incident_command.primary_objective')}
                objective={assignment.PrimaryObjective}
                progressText={t('incident_command.progress', { percent: assignment.PrimaryObjective.ProgressPercent })}
                testID="incident-command-primary-objective"
              />
            ) : null}
            {assignment.SecondaryObjective ? (
              <LaneObjectiveRow
                label={t('incident_command.secondary_objective')}
                objective={assignment.SecondaryObjective}
                progressText={t('incident_command.progress', { percent: assignment.SecondaryObjective.ProgressPercent })}
                testID="incident-command-secondary-objective"
              />
            ) : null}
            {assignment.LinkedNeed ? (
              <Box className="pb-2" testID="incident-command-linked-need">
                <Text className="text-sm text-gray-500">{t('incident_command.linked_need')}</Text>
                <HStack className="items-center justify-between">
                  <Text className="font-medium">{assignment.LinkedNeed.Name}</Text>
                  <Badge action={getNeedStatusAction(assignment.LinkedNeed.Status)} size="sm">
                    <BadgeText>{t(`incident_command.need_status.${NEED_STATUS_KEYS[assignment.LinkedNeed.Status] ?? 'open'}`)}</BadgeText>
                  </Badge>
                </HStack>
              </Box>
            ) : null}
          </VStack>
        </Box>
      ) : null}

      {/* Incident info card */}
      <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-info-card">
        <Heading size="sm">{t('incident_command.incident_info')}</Heading>
        <VStack className="mt-2 space-y-3">
          {view.Commander ? <ContactRow label={t('incident_command.commander')} contact={view.Commander} testID="incident-command-commander" /> : null}
          <Box className="border-b border-outline-100 pb-2">
            <Text className="text-sm text-gray-500">{t('incident_command.established')}</Text>
            <Text className="font-medium">{formatDateTime(view.EstablishedOn)}</Text>
          </Box>
          {view.EstimatedEndOn ? (
            <Box className="border-b border-outline-100 pb-2">
              <Text className="text-sm text-gray-500">{t('incident_command.estimated_end')}</Text>
              <Text className="font-medium">{formatDateTime(view.EstimatedEndOn)}</Text>
            </Box>
          ) : null}
          {view.ImportantInformation ? (
            <Box className={`rounded-lg border-l-4 border-amber-500 p-3 ${colorScheme === 'dark' ? 'bg-amber-950' : 'bg-amber-50'}`} testID="incident-command-important-information">
              <Text className="text-sm font-semibold text-amber-600">{t('incident_command.important_information')}</Text>
              <Text className="text-sm">{view.ImportantInformation}</Text>
            </Box>
          ) : null}
          {view.IncidentActionPlan ? (
            <Box className="pb-2" testID="incident-command-action-plan">
              <Text className="text-sm text-gray-500">{t('incident_command.action_plan')}</Text>
              <Text className="text-sm">{view.IncidentActionPlan}</Text>
            </Box>
          ) : null}
        </VStack>
      </Box>

      {/* Incident chat: the channels this responder may open, plus who they can reach 1:1. */}
      <IncidentChatSection view={view} />

      {/* Objectives */}
      <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-objectives">
        <Heading size="sm">{t('incident_command.objectives')}</Heading>
        {view.Objectives.length > 0 ? (
          <VStack className="mt-2 space-y-3">
            {view.Objectives.map((objective) => (
              <Box key={objective.TacticalObjectiveId} className="border-b border-outline-100 pb-2">
                <HStack className="items-center justify-between">
                  <Text className="flex-1 font-medium">{objective.Name}</Text>
                  <Badge action={getObjectiveStatusAction(objective.Status)} size="sm">
                    <BadgeText>{t(`incident_command.objective_status.${OBJECTIVE_STATUS_KEYS[objective.Status] ?? 'pending'}`)}</BadgeText>
                  </Badge>
                </HStack>
                <HStack className="mt-1 items-center justify-between">
                  <Text className="text-sm text-gray-500">{t(`incident_command.objective_type.${OBJECTIVE_TYPE_KEYS[objective.ObjectiveType] ?? 'general'}`)}</Text>
                  <Text className="text-sm text-gray-500">{t('incident_command.progress', { percent: objective.ProgressPercent })}</Text>
                </HStack>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text className="mt-2 text-sm text-gray-500">{t('incident_command.no_objectives')}</Text>
        )}
      </Box>

      {/* Needs */}
      <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-needs">
        <Heading size="sm">{t('incident_command.needs')}</Heading>
        {view.Needs.length > 0 ? (
          <VStack className="mt-2 space-y-3">
            {view.Needs.map((need) => (
              <Box key={need.IncidentNeedId} className="border-b border-outline-100 pb-2">
                <HStack className="items-center justify-between">
                  <Text className="flex-1 font-medium">{need.Name}</Text>
                  <Badge action={getNeedStatusAction(need.Status)} size="sm">
                    <BadgeText>{t(`incident_command.need_status.${NEED_STATUS_KEYS[need.Status] ?? 'open'}`)}</BadgeText>
                  </Badge>
                </HStack>
                <HStack className="mt-1 items-center justify-between">
                  <Text className="text-sm text-gray-500">{t(`incident_command.need_category.${NEED_CATEGORY_KEYS[need.Category] ?? 'other'}`)}</Text>
                  {need.QuantityRequested > 0 ? <Text className="text-sm text-gray-500">{t('incident_command.quantity_fulfilled', { fulfilled: need.QuantityFulfilled, requested: need.QuantityRequested })}</Text> : null}
                </HStack>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text className="mt-2 text-sm text-gray-500">{t('incident_command.no_needs')}</Text>
        )}
      </Box>

      {/* Notes */}
      <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-notes">
        <Heading size="sm">{t('incident_command.notes')}</Heading>
        {notes.length > 0 ? (
          <VStack className="mt-2 space-y-3">
            {notes.map((note) => (
              <Box key={note.IncidentNoteId} className="border-b border-outline-100 pb-2">
                {note.Title ? <Text className="font-medium">{note.Title}</Text> : null}
                <Text className="text-sm">{note.Body}</Text>
                <Text className="mt-1 text-xs text-gray-500">{formatDateTime(note.CreatedOn)}</Text>
              </Box>
            ))}
          </VStack>
        ) : (
          <Text className="mt-2 text-sm text-gray-500">{t('incident_command.no_notes')}</Text>
        )}
      </Box>

      {/* Attachments */}
      <Box className={`rounded-lg p-4 shadow-xs ${cardClass}`} testID="incident-command-attachments">
        <Heading size="sm">{t('incident_command.attachments')}</Heading>
        {attachments.length > 0 ? (
          <VStack className="mt-2 space-y-3">
            {attachments.map((attachment) => (
              <HStack key={attachment.IncidentAttachmentId} className="items-center justify-between border-b border-outline-100 pb-2">
                <Text className="flex-1 font-medium">{attachment.FileName}</Text>
                <Text className="text-sm text-gray-500">{formatBytes(attachment.ContentLength)}</Text>
              </HStack>
            ))}
          </VStack>
        ) : (
          <Text className="mt-2 text-sm text-gray-500">{t('incident_command.no_attachments')}</Text>
        )}
      </Box>
    </VStack>
  );
};
