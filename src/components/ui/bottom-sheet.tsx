import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Center } from './center';
import { Spinner } from './spinner';
import { Text } from './text';
import { VStack } from './vstack';

interface CustomBottomSheetProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  loadingText?: string;
  snapPoints?: number[];
  minHeight?: string;
  testID?: string;
}

export function CustomBottomSheet({
  children,
  isOpen,
  onClose,
  isLoading = false,
  loadingText,
  snapPoints = [67],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  minHeight: _minHeight = 'min-h-[400px]',
  testID,
}: CustomBottomSheetProps) {
  const { colorScheme } = useColorScheme();
  const { height: windowHeight } = useWindowDimensions();

  // Modal visibility is managed separately so the close animation can finish
  // before the Modal is unmounted.
  const [modalVisible, setModalVisible] = useState(false);
  // Track whether we've ever been opened so the close branch doesn't fire on mount.
  const hasBeenOpened = useRef(false);
  // Prevent the backdrop from capturing the same touch event that opened the sheet.
  // On Android, transparent Modal renders instantly and the opening tap propagates
  // to the backdrop Pressable, causing an immediate close.
  const [backdropEnabled, setBackdropEnabled] = useState(false);
  const backdropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Compute sheet height from first snap point (percentage of screen height).
  // Clamp between 300px and the screen height to remain usable in all orientations.
  const rawSheetHeight =
    snapPoints.length > 0
      ? Math.round(snapPoints[0] * windowHeight * 0.01)
      : Math.round(0.67 * windowHeight);
  const sheetHeight = Math.max(300, Math.min(rawSheetHeight, windowHeight - 20));

  useEffect(() => {
    if (isOpen) {
      hasBeenOpened.current = true;
      setBackdropEnabled(false);
      // Show the modal immediately, then animate in
      setModalVisible(true);
      translateY.setValue(1);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.5,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Enable backdrop taps after the animation completes so the opening
      // tap doesn't propagate to the backdrop on Android.
      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
      backdropTimerRef.current = setTimeout(() => {
        setBackdropEnabled(true);
      }, 300);
    } else if (hasBeenOpened.current) {
      setBackdropEnabled(false);
      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
      // Only animate out if we were previously visible (skip on initial mount)
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
        }
      });
    }
    return () => {
      if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
      testID={testID}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1 }}
        onPress={backdropEnabled ? handleClose : undefined}
        testID={testID ? `${testID}-backdrop` : undefined}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            opacity: backdropOpacity,
          }}
        />
      </Pressable>

      {/* Sheet content */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: sheetHeight,
          transform: [{ translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, sheetHeight] }) }],
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          backgroundColor: colorScheme === 'dark' ? '#171717' : '#ffffff',
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        testID={testID ? `${testID}-content` : undefined}
      >
        {/* Drag indicator */}
        <VStack className="w-full items-center py-2">
          <Center className="w-16 h-1 bg-gray-400 rounded-full" />
        </VStack>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          <VStack className="w-full flex-1" space="md">
            {isLoading ? (
              <Center className="h-32">
                <VStack space="sm" className="items-center">
                  <Spinner size="large" />
                  {loadingText && (
                    <Text className="text-sm text-gray-500">{loadingText}</Text>
                  )}
                </VStack>
              </Center>
            ) : (
              children
            )}
          </VStack>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
