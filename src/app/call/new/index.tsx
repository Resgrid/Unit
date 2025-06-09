import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { ChevronDownIcon, PlusIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import * as z from 'zod';

import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import useAuthStore from '@/stores/auth/store';
import { useCallsStore } from '@/stores/calls/store';

// Define the form schema using zod
const formSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  nature: z.string().min(1, { message: 'Nature is required' }),
  note: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  priority: z.string().min(1, { message: 'Priority is required' }),
  type: z.string().optional(),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCall() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { callPriorities, isLoading, error, fetchCallPriorities } = useCallsStore();
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      nature: '',
      note: '',
      address: '',
      coordinates: '',
      what3words: '',
      plusCode: '',
      latitude: undefined,
      longitude: undefined,
      priority: '',
      type: '',
      contactName: '',
      contactInfo: '',
    },
  });

  useEffect(() => {
    fetchCallPriorities();
  }, [fetchCallPriorities]);

  const onSubmit = async (data: FormValues) => {
    try {
      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // TODO: Implement the API call to create a new call
      console.log('Creating new call with data:', data);

      // Show success toast
      toast.show({
        placement: 'top',
        render: ({ id }) => {
          return (
            <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
              <Text className="text-white">{t('calls.create_success')}</Text>
            </Box>
          );
        },
      });

      // Navigate back to calls list
      router.push('/calls');
    } catch (error) {
      console.error('Error creating call:', error);

      // Show error toast
      toast.show({
        placement: 'top',
        render: ({ id }) => {
          return (
            <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
              <Text className="text-white">{t('calls.create_error')}</Text>
            </Box>
          );
        },
      });
    }
  };

  // Handle location selection from the full-screen picker
  const handleLocationSelected = (location: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(location);
    setShowLocationPicker(false);

    // Update form values
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);

    if (location.address) {
      setValue('address', location.address);
    }

    // Format coordinates as string
    setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <View className="size-full flex-1">
        <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('calls.new_call'),
          headerShown: true,
        }}
      />
      <View className="size-full flex-1">
        <Box className={`size-full w-full flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
          <ScrollView className="flex-1 px-4 py-6">
            <Text className="mb-6 text-2xl font-bold">{t('calls.create_new_call')}</Text>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.name}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.name')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
                {errors.name && <FormControlError>{errors.name.message}</FormControlError>}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.nature}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.nature')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="nature"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.nature_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
                {errors.nature && <FormControlError>{errors.nature.message}</FormControlError>}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.priority}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.priority')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field: { onChange, value } }) => (
                    <>
                      <Select onValueChange={onChange} selectedValue={value}>
                        <SelectTrigger>
                          <SelectInput placeholder={t('calls.select_priority')} className="w-[240px]" />
                          <SelectIcon as={ChevronDownIcon} className="mr-3" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdrop />
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          <SelectContent>
                            {callPriorities.map((priority) => (
                              <SelectItem key={priority.Id} label={priority.Name} value={priority.Id.toString()} />
                            ))}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    </>
                  )}
                />
                {errors.priority && <FormControlError>{errors.priority.message}</FormControlError>}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.note')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="note"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Textarea>
                      <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} />
                    </Textarea>
                  )}
                />
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <Text className="mb-4 text-lg font-semibold">{t('calls.call_location')}</Text>

              {/* Address Field */}
              <FormControl className="mb-4">
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.address')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.address_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>

              {/* GPS Coordinates Field */}
              <FormControl className="mb-4">
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.coordinates')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="coordinates"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.coordinates_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>

              {/* what3words Field */}
              <FormControl className="mb-4">
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.what3words')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="what3words"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.what3words_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>

              {/* Plus Code Field */}
              <FormControl className="mb-4">
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.plus_code')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="plusCode"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.plus_code_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>

              {/* Map Preview */}
              <Box className="mb-4">
                {selectedLocation ? (
                  <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                ) : (
                  <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                    <ButtonText>{t('calls.select_location')}</ButtonText>
                  </Button>
                )}
              </Box>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.contact_name')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="contactName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.contact_name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.contact_info')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="contactInfo"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.contact_info_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>
            </Card>

            <Box className="mb-6 flex-row space-x-4">
              <Button className="flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="flex-1" variant="solid" action="primary" onPress={handleSubmit(onSubmit)}>
                <PlusIcon size={18} className="mr-2 text-white" />
                <ButtonText>{t('calls.create')}</ButtonText>
              </Button>
            </Box>
          </ScrollView>
        </Box>
      </View>

      {/* Full-screen location picker modal */}
      {showLocationPicker && <FullScreenLocationPicker initialLocation={selectedLocation || undefined} onLocationSelected={handleLocationSelected} onClose={() => setShowLocationPicker(false)} />}
    </>
  );
}
