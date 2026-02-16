import { Calendar, Tag, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { HtmlRenderer } from '@/components/ui/html-renderer';

import { useAnalytics } from '@/hooks/use-analytics';
import { formatDateForDisplay, parseDateISOString, stripHtmlTags } from '@/lib/utils';
import { useProtocolsStore } from '@/stores/protocols/store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button } from '../ui/button';
import { Divider } from '../ui/divider';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

export const ProtocolDetailsSheet: React.FC = () => {
  const { trackEvent } = useAnalytics();
  const protocols = useProtocolsStore((s) => s.protocols);
  const selectedProtocolId = useProtocolsStore((s) => s.selectedProtocolId);
  const isDetailsOpen = useProtocolsStore((s) => s.isDetailsOpen);
  const closeDetails = useProtocolsStore((s) => s.closeDetails);

  const selectedProtocol = protocols.find((protocol) => protocol.ProtocolId === selectedProtocolId);

  // Track when protocol details sheet is opened/rendered
  useEffect(() => {
    if (isDetailsOpen && selectedProtocol) {
      trackEvent('protocol_details_sheet_opened', {
        protocolId: selectedProtocol.ProtocolId,
        protocolName: selectedProtocol.Name,
        hasCode: !!selectedProtocol.Code,
        hasDescription: !!selectedProtocol.Description,
        hasProtocolText: !!selectedProtocol.ProtocolText,
        protocolTextLength: selectedProtocol.ProtocolText?.length || 0,
      });
    }
  }, [isDetailsOpen, selectedProtocol, trackEvent]);

  if (!selectedProtocol) {
    return (
      <Actionsheet isOpen={isDetailsOpen} onClose={closeDetails} snapPoints={[67]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="w-full rounded-t-xl bg-white dark:bg-gray-800" />
      </Actionsheet>
    );
  }


  return (
    <Actionsheet isOpen={isDetailsOpen} onClose={closeDetails} snapPoints={[67]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full rounded-t-xl bg-white dark:bg-gray-800" key={selectedProtocolId}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <Box className="w-full flex-1 p-4">
          <HStack className="mb-4 items-center justify-between">
            <Heading size="lg" className="text-gray-800 dark:text-gray-100">
              {selectedProtocol.Name}
            </Heading>
            <Button variant="link" onPress={closeDetails} className="p-1" testID="close-button">
              <X size={24} className="text-gray-600 dark:text-gray-400" />
            </Button>
          </HStack>

          <VStack space="md" className="flex-1">
            {/* Protocol code */}
            {selectedProtocol.Code && (
              <HStack space="xs" className="items-center">
                <Tag size={18} className="text-gray-600 dark:text-gray-400" />
                <Text className="text-gray-700 dark:text-gray-300">{selectedProtocol.Code}</Text>
              </HStack>
            )}

            {/* Protocol description */}
            {selectedProtocol.Description && (
              <Box className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                <Text className="text-gray-700 dark:text-gray-300">{stripHtmlTags(selectedProtocol.Description)}</Text>
              </Box>
            )}

            {/* Protocol content */}
            <Box className="w-full flex-1 rounded-lg bg-gray-50 p-1 dark:bg-gray-700">
              <HtmlRenderer
                html={selectedProtocol.ProtocolText}
                style={styles.container}
                scrollEnabled={true}
                showsVerticalScrollIndicator={true}
                rendererKey={selectedProtocolId}
              />
            </Box>

            <Divider />

            {/* Date information */}
            <HStack space="xs" className="items-center">
              <Calendar size={18} className="text-gray-600 dark:text-gray-400" />
              <Text className="text-gray-700 dark:text-gray-300">{formatDateForDisplay(parseDateISOString(selectedProtocol.UpdatedOn || selectedProtocol.CreatedOn), 'yyyy-MM-dd HH:mm Z')}</Text>
            </HStack>
          </VStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 380, // Larger height for 2/3 screen
    backgroundColor: 'transparent',
  },
});
