import React from 'react';
import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FileQuestion } from 'lucide-react-native';
import { Center } from '../ui/center';
import { VStack } from '../ui/vstack';
import { Box } from '../ui/box';
import { Heading } from '../ui/heading';

interface ZeroStateProps {
  /**
   * Icon to display (Lucide React Native icon)
   * @default FileQuestion
   */
  icon?: LucideIcon;

  /**
   * Size of the icon
   * @default 80
   */
  iconSize?: number;

  /**
   * Color of the icon
   * @default "#64748b" (slate-500)
   */
  iconColor?: string;

  /**
   * Heading text
   * @default "No data available"
   */
  heading?: string;

  /**
   * Description text
   * @default "There's nothing to display at the moment"
   */
  description?: string;

  /**
   * Additional content to render below the description
   */
  children?: React.ReactNode;

  /**
   * Whether this is an error state
   * @default false
   */
  isError?: boolean;

  /**
   * Custom class name for additional styling
   */
  className?: string;
}

/**
 * ZeroState component for displaying empty states or error messages
 */
const ZeroState: React.FC<ZeroStateProps> = ({
  icon: Icon = FileQuestion,
  iconSize = 80,
  iconColor = '#64748b', // slate-500
  heading,
  description,
  children,
  isError = false,
  className = '',
}) => {
  const { t } = useTranslation();

  // Default texts with translations
  const defaultHeading = isError
    ? t('common.errorOccurred', 'An error occurred')
    : t('common.noDataAvailable', 'No data available');

  const defaultDescription = isError
    ? t('common.tryAgainLater', 'Please try again later')
    : t('common.nothingToDisplay', "There's nothing to display at the moment");

  return (
    <Center className={`flex-1 p-6 ${className}`} testID="zero-state">
      <VStack space="md" className="items-center">
        <Box className="mb-4">
          <Icon size={iconSize} color={isError ? '#ef4444' : iconColor} />
        </Box>

        <Heading
          size="lg"
          className={`text-center mb-2 ${isError ? 'text-red-500' : 'text-slate-700'}`}
        >
          {heading || defaultHeading}
        </Heading>

        <Text className="text-center text-slate-500 mb-6">
          {description || defaultDescription}
        </Text>

        {children}
      </VStack>
    </Center>
  );
};

export default ZeroState;
