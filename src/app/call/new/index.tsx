import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as z from 'zod';

import { createCall } from '@/api/calls/calls';
import { CallAddressSelectionSheet, CallLocationSearchField } from '@/components/calls/call-location-fields';
import { DestinationPoiSelector } from '@/components/calls/destination-poi-selector';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { DateTimeField } from '@/components/common/date-time-field';
import { HeaderBackButton } from '@/components/common/header-back-button';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { Box } from '@/components/ui/box';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { ChevronDownIcon, PlusIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useCallLocationSearch } from '@/hooks/use-call-location-search';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import {
  CALL_FIELD_LABEL_KEYS,
  CALL_IDENTIFIER_FIELDS,
  DISPATCH_ON_MIN_LEAD_MINUTES,
  formatCallFieldLabels,
  getEnforcedMissingCallFields,
  getMissingRequiredCallFields,
  getNewCallFieldValues,
  isDispatchOnTooSoon,
} from '@/lib/call-field-policy';
import { logger } from '@/lib/logging';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

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
  destinationPoiId: z.string().optional(),
  priority: z.string().min(1, { message: 'Priority is required' }),
  type: z.string().min(1, { message: 'Type is required' }),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  dispatchOn: z.string().optional(),
  dispatchSelection: z
    .object({
      everyone: z.boolean(),
      users: z.array(z.string()),
      groups: z.array(z.string()),
      roles: z.array(z.string()),
      units: z.array(z.string()),
    })
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCall() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const callPriorities = useCallsStore((state) => state.callPriorities);
  const callTypes = useCallsStore((state) => state.callTypes);
  const destinationPois = useCallsStore((state) => state.destinationPois);
  const poiTypes = useCallsStore((state) => state.poiTypes);
  const isLoading = useCallsStore((state) => state.isLoading);
  const error = useCallsStore((state) => state.error);
  const fetchCallFormData = useCallsStore((state) => state.fetchCallFormData);
  const { trackEvent } = useAnalytics();
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection>({
    everyone: false,
    users: [],
    groups: [],
    roles: [],
    units: [],
  });

  // The department's new-call field policy: hides fields it does not use and blocks submission
  // until the ones it marked required have values. Unconfigured departments see the stock form.
  const fieldPolicy = useNewCallFieldPolicy();
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
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
      destinationPoiId: '',
      priority: '',
      type: '',
      contactName: '',
      contactInfo: '',
      externalId: '',
      incidentId: '',
      referenceId: '',
      dispatchOn: '',
      dispatchSelection: {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      },
    },
  });

  useEffect(() => {
    fetchCallFormData();
  }, [fetchCallFormData]);

  // Track when new call view is rendered
  useEffect(() => {
    trackEvent('new_call_view_rendered', {
      prioritiesCount: callPriorities.length,
      typesCount: callTypes.length,
    });
  }, [trackEvent, callPriorities.length, callTypes.length]);

  const onSubmit = async (data: FormValues) => {
    try {
      // The policy arrives asynchronously and reads as "nothing required" until it lands, so a
      // submit in that window would skip every field the department marked required. Hold the call
      // back instead. Fail-open only applies once the lookup has finished one way or the other.
      if (!fieldPolicy.isLoaded) {
        toast.error(t('calls.field_policy_loading'));
        return;
      }

      // The department may require fields beyond the built-in mandatory four. Enforced here for a
      // clear message, and again on the server so an old build cannot slip an incomplete call past.
      // Checked against what createCall will send (the location as the same "lat,lon" point rule the
      // server applies). Only the fields this screen renders are enforced — see CALL_FORM_FIELDS.
      const missingFields = getEnforcedMissingCallFields(
        fieldPolicy.missingRequired(
          getNewCallFieldValues({
            note: data.note,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            what3words: data.what3words,
            plusCode: data.plusCode,
            contactName: data.contactName,
            contactInfo: data.contactInfo,
            externalId: data.externalId,
            incidentId: data.incidentId,
            referenceId: data.referenceId,
            dispatchOn: data.dispatchOn,
            destinationPoiId: data.destinationPoiId,
            dispatchSelection,
          })
        )
      );

      if (missingFields.length > 0) {
        toast.error(t('calls.required_fields_missing', { fields: formatCallFieldLabels(missingFields, (labelKey) => t(labelKey)) }));
        return;
      }

      // A scheduled dispatch has to leave the dispatcher time to change their mind — the web form's rule.
      if (data.dispatchOn && isDispatchOnTooSoon(data.dispatchOn)) {
        toast.error(t('calls.dispatch_on_too_soon', { minutes: DISPATCH_ON_MIN_LEAD_MINUTES }));
        return;
      }

      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // Validate priority and type before proceeding
      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      if (!priority) {
        toast.error(t('calls.invalid_priority'));
        return;
      }

      if (!type) {
        toast.error(t('calls.invalid_type'));
        return;
      }

      const response = await createCall({
        name: data.name,
        nature: data.nature,
        priority: priority.Id,
        // The API matches the call type by its text, not its id.
        type: type.Name,
        note: data.note,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        destinationPoiId: data.destinationPoiId ? Number(data.destinationPoiId) : null,
        what3words: data.what3words,
        plusCode: data.plusCode,
        // The reporter's name and contact details were collected but never sent, so a call saved
        // without them and a department requiring them was refused by the server for no visible reason.
        contactName: data.contactName,
        contactInfo: data.contactInfo,
        externalId: data.externalId,
        incidentId: data.incidentId,
        referenceId: data.referenceId,
        // Only when one is set: no time means "dispatch now".
        dispatchOnUtc: data.dispatchOn || undefined,
        dispatchUsers: data.dispatchSelection?.users,
        dispatchGroups: data.dispatchSelection?.groups,
        dispatchRoles: data.dispatchSelection?.roles,
        dispatchUnits: data.dispatchSelection?.units,
        dispatchEveryone: data.dispatchSelection?.everyone,
      });

      // Show success toast
      toast.success(t('calls.create_success'));

      // Navigate back to calls list
      router.push('/calls');
    } catch (error) {
      logger.error({ message: 'Error creating call', context: { error } });

      // The server enforces the full policy, including fields this screen has no input for; name
      // them the way the form does rather than showing a generic failure.
      const serverMissingFields = getMissingRequiredCallFields(error);

      if (serverMissingFields) {
        toast.error(t('calls.required_fields_missing', { fields: formatCallFieldLabels(serverMissingFields, (labelKey) => t(labelKey)) }));
        return;
      }

      // Show error toast
      toast.error(t('calls.create_error'));
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

  // Address, coordinates, what3words and plus code lookups — shared with the edit-call screen.
  const locationSearch = useCallLocationSearch(handleLocationSelected);

  // Handle dispatch selection
  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
  };

  // Get dispatch selection summary
  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const count = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (count === 0) {
      return t('calls.select_recipients');
    }

    return `${count} ${t('calls.selected')}`;
  };

  // The location card holds four separate policy fields plus the destination selector; each is
  // hidden on its own, and the card itself goes away once the department has turned all of them off.
  const showAddress = fieldPolicy.isVisible(NewCallFieldKeys.Address);
  const showGeolocation = fieldPolicy.isVisible(NewCallFieldKeys.Geolocation);
  const showWhat3Words = fieldPolicy.isVisible(NewCallFieldKeys.What3Words);
  const showPlusCode = fieldPolicy.isVisible(NewCallFieldKeys.PlusCode);
  const showDestinationPoi = fieldPolicy.isVisible(NewCallFieldKeys.DestinationPoi);
  const showDispatchList = fieldPolicy.isVisible(NewCallFieldKeys.DispatchList);
  const visibleIdentifierFields = CALL_IDENTIFIER_FIELDS.filter((field) => fieldPolicy.isVisible(field.key));
  const showLocationCard = showAddress || showGeolocation || showWhat3Words || showPlusCode || showDestinationPoi;

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
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('calls.new_call'),
          headerShown: true,
          headerBackTitle: '',
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
            <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }} style={{ paddingTop: Math.max(insets.top, 16) }} keyboardShouldPersistTaps="handled">
              <Text className="mb-6 text-2xl font-bold">{t('calls.create_new_call')}</Text>

              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired isInvalid={!!errors.name}>
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
                  {errors.name ? (
                    <FormControlError>
                      <Text className="text-red-500">{errors.name.message}</Text>
                    </FormControlError>
                  ) : null}
                </FormControl>
              </Card>

              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired isInvalid={!!errors.nature}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.nature')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="nature"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Textarea>
                        <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.nature_placeholder')} />
                      </Textarea>
                    )}
                  />
                  {errors.nature ? (
                    <FormControlError>
                      <Text className="text-red-500">{errors.nature.message}</Text>
                    </FormControlError>
                  ) : null}
                </FormControl>
              </Card>

              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired isInvalid={!!errors.priority}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.priority')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field: { onChange, value } }) => (
                      <Select onValueChange={onChange} selectedValue={value}>
                        <SelectTrigger>
                          <SelectInput placeholder={t('calls.select_priority')} className="w-5/6" />
                          <SelectIcon as={ChevronDownIcon} className="mr-3" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdrop />
                          <SelectContent>
                            {callPriorities.map((priority) => (
                              <SelectItem key={priority.Id} label={priority.Name} value={priority.Name} />
                            ))}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    )}
                  />
                  {errors.priority ? (
                    <FormControlError>
                      <Text className="text-red-500">{errors.priority.message}</Text>
                    </FormControlError>
                  ) : null}
                </FormControl>
              </Card>

              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired isInvalid={!!errors.type}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.type')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="type"
                    render={({ field: { onChange, value } }) => (
                      <Select onValueChange={onChange} selectedValue={value}>
                        <SelectTrigger>
                          <SelectInput placeholder={t('calls.select_type')} className="w-5/6" />
                          <SelectIcon as={ChevronDownIcon} className="mr-3" />
                        </SelectTrigger>
                        <SelectPortal>
                          <SelectBackdrop />
                          <SelectContent>
                            {callTypes.map((type) => (
                              <SelectItem key={type.Id} label={type.Name} value={type.Name} />
                            ))}
                          </SelectContent>
                        </SelectPortal>
                      </Select>
                    )}
                  />
                  {errors.type ? (
                    <FormControlError>
                      <Text className="text-red-500">{errors.type.message}</Text>
                    </FormControlError>
                  ) : null}
                </FormControl>
              </Card>

              {fieldPolicy.isVisible(NewCallFieldKeys.Note) ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Note)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.note')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="note"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Textarea>
                          <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.note_placeholder')} />
                        </Textarea>
                      )}
                    />
                  </FormControl>
                </Card>
              ) : null}

              {showLocationCard ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <Text className="mb-4 text-lg font-semibold">{t('calls.call_location')}</Text>

                  {/* Address Field */}
                  {showAddress ? (
                    <Controller
                      control={control}
                      name="address"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <CallLocationSearchField
                          label={t('calls.address')}
                          isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Address)}
                          testIDPrefix="address"
                          placeholder={t('calls.address_placeholder')}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          onSearch={locationSearch.searchAddress}
                          isSearching={locationSearch.isGeocodingAddress}
                        />
                      )}
                    />
                  ) : null}

                  {/* GPS Coordinates Field */}
                  {showGeolocation ? (
                    <Controller
                      control={control}
                      name="coordinates"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <CallLocationSearchField
                          label={t('calls.coordinates')}
                          isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Geolocation)}
                          testIDPrefix="coordinates"
                          placeholder={t('calls.coordinates_placeholder')}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          onSearch={locationSearch.searchCoordinates}
                          isSearching={locationSearch.isGeocodingCoordinates}
                        />
                      )}
                    />
                  ) : null}

                  {/* what3words Field */}
                  {showWhat3Words ? (
                    <Controller
                      control={control}
                      name="what3words"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <CallLocationSearchField
                          label={t('calls.what3words')}
                          isRequired={fieldPolicy.isRequired(NewCallFieldKeys.What3Words)}
                          testIDPrefix="what3words"
                          placeholder={t('calls.what3words_placeholder')}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          onSearch={locationSearch.searchWhat3Words}
                          isSearching={locationSearch.isGeocodingWhat3Words}
                        />
                      )}
                    />
                  ) : null}

                  {/* Plus Code Field — a lookup aid only (never stored), so never required. */}
                  {showPlusCode ? (
                    <Controller
                      control={control}
                      name="plusCode"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <CallLocationSearchField
                          label={t('calls.plus_code')}
                          testIDPrefix="plus-code"
                          placeholder={t('calls.plus_code_placeholder')}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          onSearch={locationSearch.searchPlusCode}
                          isSearching={locationSearch.isGeocodingPlusCode}
                        />
                      )}
                    />
                  ) : null}

                  {/* Map Preview — the map is how a geolocation gets picked, so it follows that field. */}
                  {showGeolocation ? (
                    <Box className="mb-4">
                      {selectedLocation ? (
                        <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                      ) : (
                        <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                          <ButtonText>{t('calls.select_location')}</ButtonText>
                        </Button>
                      )}
                    </Box>
                  ) : null}

                  {showDestinationPoi ? (
                    <Controller
                      control={control}
                      name="destinationPoiId"
                      render={({ field: { onChange, value } }) => (
                        <DestinationPoiSelector
                          destinationPois={destinationPois}
                          poiTypes={poiTypes}
                          selectedPoiId={value ? Number(value) : null}
                          isLoading={isLoading && destinationPois.length === 0}
                          onChange={(poiId) => onChange(poiId != null ? poiId.toString() : '')}
                          isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DestinationPoi)}
                        />
                      )}
                    />
                  ) : null}
                </Card>
              ) : null}

              {fieldPolicy.isVisible(NewCallFieldKeys.ContactName) ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactName)}>
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
              ) : null}

              {fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo) ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactInfo)}>
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
              ) : null}

              {visibleIdentifierFields.length > 0 ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  {visibleIdentifierFields.map((field, index) => (
                    <FormControl key={field.key} className={index < visibleIdentifierFields.length - 1 ? 'mb-4' : undefined} isRequired={fieldPolicy.isRequired(field.key)}>
                      <FormControlLabel>
                        <FormControlLabelText>{t(CALL_FIELD_LABEL_KEYS[field.key])}</FormControlLabelText>
                      </FormControlLabel>
                      <Controller
                        control={control}
                        name={field.name}
                        render={({ field: { onChange, onBlur, value } }) => (
                          <Input>
                            <InputField testID={field.testID} value={value} onChangeText={onChange} onBlur={onBlur} />
                          </Input>
                        )}
                      />
                    </FormControl>
                  ))}
                </Card>
              ) : null}

              {fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn) ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DispatchOn)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.dispatch_on')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="dispatchOn"
                      render={({ field: { onChange, value } }) => <DateTimeField mode="datetime" value={value ?? ''} onChange={onChange} label={t('calls.dispatch_on')} testID="dispatch-on-field" />}
                    />
                  </FormControl>
                </Card>
              ) : null}

              {showDispatchList ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <Text className="mb-4 text-lg font-semibold">
                    {t('calls.dispatch_to')}
                    {fieldPolicy.isRequired(NewCallFieldKeys.DispatchList) ? '*' : ''}
                  </Text>
                  <Button onPress={() => setShowDispatchModal(true)} className="w-full">
                    <ButtonText>{getDispatchSummary()}</ButtonText>
                  </Button>
                </Card>
              ) : null}

              <Box className="mb-6 flex-row space-x-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
                <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                  <ButtonText>{t('common.cancel')}</ButtonText>
                </Button>
                <Button className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded || isSubmitting} onPress={handleSubmit(onSubmit)} testID="create-call-button">
                  {isSubmitting ? <ButtonSpinner className="mr-2" /> : <PlusIcon size={18} className="mr-2 text-typography-0" />}
                  <ButtonText>{isSubmitting ? t('common.submitting') : t('calls.create')}</ButtonText>
                </Button>
              </Box>
            </ScrollView>
          </KeyboardAvoidingView>
        </Box>
      </View>

      {/* Full-screen location picker overlay */}
      {showLocationPicker ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
        >
          <FullScreenLocationPicker
            key={showLocationPicker ? 'location-picker-open' : 'location-picker-closed'}
            initialLocation={selectedLocation || undefined}
            onLocationSelected={handleLocationSelected}
            onClose={() => setShowLocationPicker(false)}
          />
        </View>
      ) : null}

      {/* Dispatch selection modal */}
      <DispatchSelectionModal isVisible={showDispatchModal} onClose={() => setShowDispatchModal(false)} onConfirm={handleDispatchSelection} initialSelection={dispatchSelection} />

      {/* Address selection bottom sheet */}
      <CallAddressSelectionSheet isOpen={locationSearch.isAddressSelectionOpen} onClose={locationSearch.closeAddressSelection} results={locationSearch.addressResults} onSelect={locationSearch.selectAddressResult} />
    </>
  );
}
