import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { type GeocodingResult } from '@/hooks/use-call-location-search';

import { CustomBottomSheet } from '../ui/bottom-sheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { FormControl, FormControlLabel, FormControlLabelText } from '../ui/form-control';
import { Input, InputField } from '../ui/input';
import { SearchIcon } from '../ui/lucide-icons';
import { Text } from '../ui/text';

interface CallLocationSearchFieldProps {
  label: string;
  isRequired?: boolean;
  /** Prefix for the input's and search button's test ids, e.g. "address" -> "address-input". */
  testIDPrefix: string;
  placeholder: string;
  value?: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onSearch: (value: string) => void;
  isSearching: boolean;
}

/** A call form's text field with a lookup button: address, GPS coordinates, what3words or plus code. */
export const CallLocationSearchField: React.FC<CallLocationSearchFieldProps> = ({ label, isRequired, testIDPrefix, placeholder, value, onChangeText, onBlur, onSearch, isSearching }) => {
  const { colorScheme } = useColorScheme();

  return (
    <FormControl className="mb-4" isRequired={isRequired}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Box className="flex-row items-center space-x-2">
        <Box className="flex-1">
          <Input>
            <InputField testID={`${testIDPrefix}-input`} placeholder={placeholder} value={value} onChangeText={onChangeText} onBlur={onBlur} />
          </Input>
        </Box>
        <Button testID={`${testIDPrefix}-search-button`} size="sm" variant="outline" className="ml-2" onPress={() => onSearch(value || '')} disabled={isSearching || !value?.trim()}>
          {isSearching ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
        </Button>
      </Box>
    </FormControl>
  );
};

interface CallAddressSelectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  results: GeocodingResult[];
  onSelect: (result: GeocodingResult) => void;
}

/** Lets the user pick one when an address lookup comes back with several matches. */
export const CallAddressSelectionSheet: React.FC<CallAddressSelectionSheetProps> = ({ isOpen, onClose, results, onSelect }) => {
  const { t } = useTranslation();

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} isLoading={false}>
      <Box className="p-4">
        <Text className="mb-4 text-center text-lg font-semibold">{t('calls.select_address')}</Text>
        <ScrollView className="max-h-96">
          {results.map((result, index) => (
            <Button key={result.place_id || index} variant="outline" className="mb-2 w-full" onPress={() => onSelect(result)}>
              <ButtonText className="flex-1 text-left" numberOfLines={2}>
                {result.formatted_address}
              </ButtonText>
            </Button>
          ))}
        </ScrollView>
      </Box>
    </CustomBottomSheet>
  );
};
