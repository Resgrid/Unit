import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as z from 'zod';

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
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { ChevronDownIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { type CallLocation, useCallLocationSearch } from '@/hooks/use-call-location-search';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import {
  CALL_FIELD_LABEL_KEYS,
  CALL_IDENTIFIER_FIELDS,
  DISPATCH_ON_MIN_LEAD_MINUTES,
  formatCallFieldLabels,
  getEditCallFieldValues,
  getEnforcedMissingCallFields,
  getMissingRequiredCallFields,
  getScheduledDispatchPrefill,
  isDispatchOnTooSoon,
  isPendingCallState,
} from '@/lib/call-field-policy';
import { logger } from '@/lib/logging';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Form validation schema (same as New Call)
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nature: z.string().min(1, 'Nature is required'),
  note: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  destinationPoiId: z.string().optional(),
  priority: z.string().min(1, 'Priority is required'),
  type: z.string().min(1, 'Type is required'),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  dispatchOn: z.string().optional(),
  dispatchSelection: z.object({
    everyone: z.boolean(),
    users: z.array(z.string()),
    groups: z.array(z.string()),
    roles: z.array(z.string()),
    units: z.array(z.string()),
  }),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DISPATCH: DispatchSelection = {
  everyone: false,
  users: [],
  groups: [],
  roles: [],
  units: [],
};

export default function EditCall() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const callPriorities = useCallsStore((state) => state.callPriorities);
  const callTypes = useCallsStore((state) => state.callTypes);
  const destinationPois = useCallsStore((state) => state.destinationPois);
  const poiTypes = useCallsStore((state) => state.poiTypes);
  const callDataLoading = useCallsStore((state) => state.isLoading);
  const callDataError = useCallsStore((state) => state.error);
  const fetchCallFormData = useCallsStore((state) => state.fetchCallFormData);
  const call = useCallDetailStore((state) => state.call);
  const callExtraData = useCallDetailStore((state) => state.callExtraData);
  const callDetailLoading = useCallDetailStore((state) => state.isLoading);
  const callDetailError = useCallDetailStore((state) => state.error);
  const fetchCallDetail = useCallDetailStore((state) => state.fetchCallDetail);
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection>(EMPTY_DISPATCH);
  const [selectedLocation, setSelectedLocation] = useState<CallLocation | null>(null);

  // The department's call field policy applies to edits too: the same fields are hidden, and the call
  // must still have every required field once the edit is saved. The server enforces it as well.
  const fieldPolicy = useNewCallFieldPolicy();

  // The scheduled dispatch time the form was seeded with ('' when the call has no upcoming schedule). Left as it
  // was, the save does not send it, so an upcoming schedule is never re-validated against the 15-minute rule just
  // because something else changed. While there is one the picker offers no "clear": EditCall cannot remove a
  // schedule, so clearing would look like it worked while the stored time stayed.
  const [initialDispatchOn, setInitialDispatchOn] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    reset,
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
      dispatchSelection: EMPTY_DISPATCH,
    },
  });

  useEffect(() => {
    fetchCallFormData();
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [fetchCallDetail, fetchCallFormData, callId]);

  // Pre-populate form when call data is loaded
  useEffect(() => {
    if (call) {
      const priority = callPriorities.find((p) => p.Id === call.Priority);
      // Call.Type is the type's text, not its id -- matching on Id left the picker blank on every edit.
      const type = callTypes.find((t) => t.Name === call.Type);

      // Seed the picker with who the call already went to. Without this the edit posted an empty
      // dispatch list, which the API reads as "dispatch the whole department".
      const initialDispatch: DispatchSelection = {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      };

      if (callExtraData?.Dispatches) {
        callExtraData.Dispatches.forEach((dispatch) => {
          const dispatchType = (dispatch.Type || '').toLowerCase();
          if (dispatchType === 'personnel' || dispatchType === 'p' || dispatchType === 'user') {
            initialDispatch.users.push(dispatch.Id);
          } else if (dispatchType === 'group' || dispatchType === 'groups' || dispatchType === 'g') {
            initialDispatch.groups.push(dispatch.Id);
          } else if (dispatchType === 'role' || dispatchType === 'roles' || dispatchType === 'r') {
            initialDispatch.roles.push(dispatch.Id);
          } else if (dispatchType === 'unit' || dispatchType === 'units' || dispatchType === 'u') {
            initialDispatch.units.push(dispatch.Id);
          }
        });
      }

      setDispatchSelection(initialDispatch);

      // Only a schedule that has not gone out yet is editable; a past time is when the call was sent.
      const dispatchOnPrefill = getScheduledDispatchPrefill(call.DispatchedOnUtc);
      setInitialDispatchOn(dispatchOnPrefill);

      reset({
        name: call.Name || '',
        nature: call.Nature || '',
        note: call.Note || '',
        address: call.Address || '',
        coordinates: call.Geolocation || '',
        what3words: call.What3Words || '',
        // A plus code is only a way to find a location; the call does not store one.
        plusCode: '',
        latitude: call.Latitude ? parseFloat(call.Latitude) : undefined,
        longitude: call.Longitude ? parseFloat(call.Longitude) : undefined,
        destinationPoiId: call.DestinationPoiId != null ? String(call.DestinationPoiId) : '',
        priority: priority?.Name || '',
        type: type?.Name || '',
        contactName: call.ContactName || '',
        contactInfo: call.ContactInfo || '',
        externalId: call.ExternalId || '',
        incidentId: call.IncidentId || '',
        referenceId: call.ReferenceId || '',
        dispatchOn: dispatchOnPrefill,
        dispatchSelection: initialDispatch,
      });

      // Set selected location if coordinates exist
      if (call.Latitude && call.Longitude) {
        setSelectedLocation({
          latitude: parseFloat(call.Latitude),
          longitude: parseFloat(call.Longitude),
          address: call.Address || undefined,
        });
      }
    }
  }, [call, callExtraData, callPriorities, callTypes, reset]);

  // Track when edit call view is rendered
  useEffect(() => {
    if (call) {
      trackEvent('edit_call_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        callPriority: call.Priority || 0,
        callType: call.Type || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
        hasAddress: !!call.Address,
      });
    }
  }, [trackEvent, call]);

  const showNote = fieldPolicy.isVisible(NewCallFieldKeys.Note);
  const showAddress = fieldPolicy.isVisible(NewCallFieldKeys.Address);
  const showGeolocation = fieldPolicy.isVisible(NewCallFieldKeys.Geolocation);
  const showWhat3Words = fieldPolicy.isVisible(NewCallFieldKeys.What3Words);
  const showPlusCode = fieldPolicy.isVisible(NewCallFieldKeys.PlusCode);
  const showDestinationPoi = fieldPolicy.isVisible(NewCallFieldKeys.DestinationPoi);
  const showContactName = fieldPolicy.isVisible(NewCallFieldKeys.ContactName);
  const showContactInfo = fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo);
  const showDispatchList = fieldPolicy.isVisible(NewCallFieldKeys.DispatchList);
  const showDispatchOn = fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn);
  const visibleIdentifierFields = CALL_IDENTIFIER_FIELDS.filter((field) => fieldPolicy.isVisible(field.key));
  const showLocationCard = showAddress || showGeolocation || showWhat3Words || showPlusCode || showDestinationPoi;

  const onSubmit = async (data: FormValues) => {
    if (!call) {
      return;
    }

    // The policy arrives asynchronously and reads as "nothing hidden, nothing required" until it
    // lands, so a save in that window could skip a required field or overwrite a hidden one.
    if (!fieldPolicy.isLoaded) {
      toast.error(t('calls.field_policy_loading'));
      return;
    }

    try {
      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // Checked against the call as the save will leave it (EditCall keeps the stored value for a blank
      // input), the same way the server checks it. A pending call has not been dispatched yet, so its
      // dispatch list is not required; the dispatch time is never asked for on an edit.
      const missingFields = getEnforcedMissingCallFields(
        fieldPolicy.missingRequired(
          getEditCallFieldValues(
            {
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
              destinationPoiId: data.destinationPoiId,
              dispatchSelection,
            },
            call
          )
        ),
        { isPending: isPendingCallState(call.State), isEdit: true }
      );

      if (missingFields.length > 0) {
        toast.error(t('calls.required_fields_missing', { fields: formatCallFieldLabels(missingFields, (labelKey) => t(labelKey)) }));
        return;
      }

      // A new or moved schedule must leave the dispatcher time to change their mind (the web form's rule). An
      // unchanged or cleared one is not sent: the API keeps the stored schedule and has no way to clear it.
      const dispatchOnChanged = showDispatchOn && !!data.dispatchOn && data.dispatchOn !== initialDispatchOn;

      if (dispatchOnChanged && isDispatchOnTooSoon(data.dispatchOn!)) {
        toast.error(t('calls.dispatch_on_too_soon', { minutes: DISPATCH_ON_MIN_LEAD_MINUTES }));
        return;
      }

      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      // A field the department hides was never on this form, so the save must leave it as stored. For
      // EditCall that means a blank text value and no location point (the server keeps the stored one, or
      // geocodes a changed address). A hidden destination and dispatch list are sent as loaded rather than
      // left out: the current server ignores both when hidden, but an older one reads a missing destination
      // as "clear it" and a blank dispatch list as "page everyone", so this is safe in any deploy order.
      const dispatch = data.dispatchSelection;

      await useCallDetailStore.getState().updateCall({
        callId: callId!,
        name: data.name,
        nature: data.nature,
        priority: priority?.Id || 0,
        // The API matches the call type by its text, not its id.
        type: type?.Name || '',
        note: showNote ? data.note : '',
        address: showAddress ? data.address : '',
        latitude: showGeolocation ? data.latitude : undefined,
        longitude: showGeolocation ? data.longitude : undefined,
        destinationPoiId: data.destinationPoiId ? Number(data.destinationPoiId) : null,
        what3words: showWhat3Words ? data.what3words : '',
        plusCode: showPlusCode ? data.plusCode : '',
        contactName: showContactName ? data.contactName : '',
        contactInfo: showContactInfo ? data.contactInfo : '',
        externalId: fieldPolicy.isVisible(NewCallFieldKeys.ExternalId) ? data.externalId : '',
        incidentId: fieldPolicy.isVisible(NewCallFieldKeys.IncidentId) ? data.incidentId : '',
        referenceId: fieldPolicy.isVisible(NewCallFieldKeys.ReferenceId) ? data.referenceId : '',
        dispatchOnUtc: dispatchOnChanged ? data.dispatchOn : undefined,
        dispatchUsers: dispatch?.users,
        dispatchGroups: dispatch?.groups,
        dispatchRoles: dispatch?.roles,
        dispatchUnits: dispatch?.units,
        dispatchEveryone: dispatch?.everyone,
      });

      toast.success(t('call_detail.update_call_success'));

      // Navigate back to call detail
      router.back();
    } catch (error) {
      logger.error({ message: 'Error updating call', context: { error } });

      // The server enforces the full policy, including fields this form has no input for; name them
      // the way the form does rather than showing a generic failure.
      const serverMissingFields = getMissingRequiredCallFields(error);

      if (serverMissingFields) {
        toast.error(t('calls.required_fields_missing', { fields: formatCallFieldLabels(serverMissingFields, (labelKey) => t(labelKey)) }));
        return;
      }

      toast.error(t('call_detail.update_call_error'));
    }
  };

  const handleLocationSelected = (location: CallLocation) => {
    setSelectedLocation(location);
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);
    if (location.address) {
      setValue('address', location.address);
    }
    setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    setShowLocationPicker(false);
  };

  // Address, coordinates, what3words and plus code lookups — shared with the new-call screen.
  const locationSearch = useCallLocationSearch(handleLocationSelected);

  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
    setShowDispatchModal(false);
  };

  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const totalSelected = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (totalSelected === 0) {
      return t('calls.select_recipients');
    }

    return `${totalSelected} ${t('calls.selected')}`;
  };

  if (callDetailLoading || callDataLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerBackTitle: '',
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <Loading />
      </>
    );
  }

  if (callDetailError || callDataError || !call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerBackTitle: '',
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View className="size-full flex-1">
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="error text-center">{callDetailError || callDataError || t('call_detail.not_found')}</Text>
          </Box>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('calls.edit_call'),
          headerShown: true,
          headerBackTitle: '',
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={10}>
            <ScrollView className="flex-1 px-4 py-6" keyboardShouldPersistTaps="handled">
              <Text className="mb-6 text-2xl font-bold">{t('calls.edit_call_description')}</Text>

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
                      <Select selectedValue={value} onValueChange={onChange}>
                        <SelectTrigger>
                          <SelectInput placeholder={t('calls.priority_placeholder')} />
                          <SelectIcon as={ChevronDownIcon} />
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
                      <Select selectedValue={value} onValueChange={onChange}>
                        <SelectTrigger>
                          <SelectInput placeholder={t('calls.select_type')} />
                          <SelectIcon as={ChevronDownIcon} />
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

              {showNote ? (
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
                          <TextareaInput testID="note-input" value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.note_placeholder')} />
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
                          isLoading={callDataLoading && destinationPois.length === 0}
                          onChange={(poiId) => onChange(poiId != null ? poiId.toString() : '')}
                          isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DestinationPoi)}
                        />
                      )}
                    />
                  ) : null}
                </Card>
              ) : null}

              {showContactName ? (
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
                          <InputField testID="contact-name-input" placeholder={t('calls.contact_name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                        </Input>
                      )}
                    />
                  </FormControl>
                </Card>
              ) : null}

              {showContactInfo ? (
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
                          <InputField testID="contact-info-input" placeholder={t('calls.contact_info_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
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

              {showDispatchOn ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  {/* Never required on an edit, so never marked. */}
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.dispatch_on')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="dispatchOn"
                      render={({ field: { onChange, value } }) => (
                        <DateTimeField mode="datetime" value={value ?? ''} onChange={onChange} label={t('calls.dispatch_on')} clearable={!initialDispatchOn} testID="dispatch-on-field" />
                      )}
                    />
                  </FormControl>
                </Card>
              ) : null}

              {showDispatchList ? (
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <Text className="mb-4 text-lg font-semibold">
                    {t('calls.dispatch_to')}
                    {fieldPolicy.isRequired(NewCallFieldKeys.DispatchList) && !isPendingCallState(call.State) ? '*' : ''}
                  </Text>
                  <Button testID="dispatch-selection-button" onPress={() => setShowDispatchModal(true)} className="w-full">
                    <ButtonText>{getDispatchSummary()}</ButtonText>
                  </Button>
                </Card>
              ) : null}

              <Box className="mb-6 flex-row space-x-4">
                <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                  <ButtonText>{t('common.cancel')}</ButtonText>
                </Button>
                <Button className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded || isSubmitting} onPress={handleSubmit(onSubmit)} testID="save-call-button">
                  {isSubmitting ? <ButtonSpinner className="mr-2" /> : null}
                  <ButtonText>{isSubmitting ? t('common.submitting') : t('common.save')}</ButtonText>
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
