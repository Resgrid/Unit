import { useColorScheme } from 'nativewind';
import React from 'react';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from './actionsheet';
import { Center } from './center';
import { Spinner } from './spinner';
import { Text } from './text';
import { VStack } from './vstack';
interface CustomBottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  loadingText?: string;
}

export function CustomBottomSheet({ children, isOpen, onClose, isLoading = false, loadingText }: CustomBottomSheetProps) {
  const { colorScheme } = useColorScheme();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[40]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className={`rounded-t-3xl px-4 pb-6 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {isLoading ? (
          <Center className="h-32">
            <VStack space="sm" className="items-center">
              <Spinner size="large" />
              {loadingText && <Text className="text-sm text-gray-500">{loadingText}</Text>}
            </VStack>
          </Center>
        ) : (
          children
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
}
