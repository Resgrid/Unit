import { isAxiosError } from 'axios';

import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { type DispatchSelection } from '@/stores/dispatch/store';

/**
 * Shared plumbing for the department's call field policy on the new-call and edit-call screens.
 *
 * The policy speaks in stable wire keys; a call-taker told to fill in 'contactName' is being shown the
 * protocol rather than their own form. Every key maps back to the label the screens put on the field,
 * and the keys the screens cannot collect still get a readable name for when the server rejects a save.
 */
export const CALL_FIELD_LABEL_KEYS: Record<NewCallFieldKey, string> = {
  [NewCallFieldKeys.Address]: 'calls.address',
  [NewCallFieldKeys.Geolocation]: 'calls.coordinates',
  [NewCallFieldKeys.What3Words]: 'calls.what3words',
  [NewCallFieldKeys.PlusCode]: 'calls.plus_code',
  [NewCallFieldKeys.DestinationPoi]: 'calls.destination_poi',
  [NewCallFieldKeys.IndoorLocation]: 'calls.indoor_location',
  [NewCallFieldKeys.Note]: 'calls.note',
  [NewCallFieldKeys.ContactName]: 'calls.contact_name',
  [NewCallFieldKeys.ContactInfo]: 'calls.contact_info',
  [NewCallFieldKeys.ExternalId]: 'call_detail.external_id',
  [NewCallFieldKeys.IncidentId]: 'calls.incident_id',
  [NewCallFieldKeys.ReferenceId]: 'call_detail.reference_id',
  [NewCallFieldKeys.Protocols]: 'call_detail.tabs.protocols',
  [NewCallFieldKeys.LinkedCall]: 'calls.linked_call',
  [NewCallFieldKeys.DispatchOn]: 'calls.dispatch_on',
  [NewCallFieldKeys.DispatchList]: 'calls.dispatch_to',
};

/**
 * The policy fields the call forms in this app have an input for. Both screens render the same set (the
 * edit form has parity with the new-call form). Indoor location, protocols and linked call have no picker
 * here and are never sent, and the server treats an omitted IndoorMapZoneId / ProtocolIds / LinkedCallId as
 * "no picker", so their rules do not apply to this app. Anything the server still rejects comes back as keys
 * that getMissingRequiredCallFields turns into labels.
 */
export const CALL_FORM_FIELDS: ReadonlySet<NewCallFieldKey> = new Set<NewCallFieldKey>([
  NewCallFieldKeys.Note,
  NewCallFieldKeys.Address,
  NewCallFieldKeys.Geolocation,
  NewCallFieldKeys.What3Words,
  NewCallFieldKeys.PlusCode,
  NewCallFieldKeys.DestinationPoi,
  NewCallFieldKeys.ContactName,
  NewCallFieldKeys.ContactInfo,
  NewCallFieldKeys.ExternalId,
  NewCallFieldKeys.IncidentId,
  NewCallFieldKeys.ReferenceId,
  NewCallFieldKeys.DispatchOn,
  NewCallFieldKeys.DispatchList,
]);

/**
 * The call identifier text inputs both call forms render (gated and marked by the policy). The server always
 * enforces these when required, so a form without them would lock a department that requires one out of
 * creating or editing calls.
 */
export const CALL_IDENTIFIER_FIELDS = [
  { key: NewCallFieldKeys.ExternalId, name: 'externalId', testID: 'external-id-input' },
  { key: NewCallFieldKeys.IncidentId, name: 'incidentId', testID: 'incident-id-input' },
  { key: NewCallFieldKeys.ReferenceId, name: 'referenceId', testID: 'reference-id-input' },
] as const;

const CANONICAL_KEYS = new Map<string, NewCallFieldKey>(Object.values(NewCallFieldKeys).map((key) => [key.toLowerCase(), key]));

/** Comma-joined labels for a list of policy keys; a key nothing knows falls back to itself rather than vanishing. */
export const formatCallFieldLabels = (keys: readonly string[], translate: (labelKey: string) => string): string =>
  keys
    .map((key) => {
      const canonical = CANONICAL_KEYS.get(key.toLowerCase());

      return canonical ? translate(CALL_FIELD_LABEL_KEYS[canonical]) : key;
    })
    .join(', ');

const MISSING_FIELDS_PREFIX = 'required call fields are missing:';

/**
 * The policy keys the server named when it refused a save ("Required call fields are missing: address, note",
 * a plain-text 400 from SaveCall and EditCall). Null for any other failure, so callers fall back to their own
 * error text.
 */
export const getMissingRequiredCallFields = (error: unknown): string[] | null => {
  if (!isAxiosError(error) || error.response?.status !== 400) {
    return null;
  }

  const data: unknown = error.response.data;
  const text = typeof data === 'string' ? data : data && typeof data === 'object' ? (data as Record<string, unknown>).Message : undefined;

  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();

  if (!trimmed.toLowerCase().startsWith(MISSING_FIELDS_PREFIX)) {
    return null;
  }

  const keys = trimmed
    .slice(MISSING_FIELDS_PREFIX.length)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  return keys.length > 0 ? keys : null;
};

const isUsablePoint = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) && Number.isFinite(longitude) && !(latitude === 0 && longitude === 0) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

/**
 * "lat,lon" when the pair is a usable point, else ''. Mirrors the server's GeoMath.ParseCoordinatePair, so a
 * required location means the same thing on both sides: both values finite and on the globe, and not 0,0. A
 * single zero coordinate is a real place on the equator or the prime meridian and counts.
 */
export const formatCallGeolocation = (latitude?: number | null, longitude?: number | null): string => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !isUsablePoint(latitude, longitude)) {
    return '';
  }

  return `${latitude},${longitude}`;
};

/** True when a stored "lat,lon" string (Call.Geolocation) is a usable point, by the same rule. */
export const isCallGeolocation = (value?: string | null): boolean => {
  if (!value || !value.trim()) {
    return false;
  }

  const parts = value.split(',');

  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    return false;
  }

  return isUsablePoint(Number(parts[0]), Number(parts[1]));
};

/** CallStates.Pending: saved for a dispatcher to send later. The API sends State as a number. */
const PENDING_CALL_STATE = 8;

export const isPendingCallState = (state: unknown): boolean => (typeof state === 'number' || typeof state === 'string') && Number(state) === PENDING_CALL_STATE;

/** "Anyone selected?" — an empty selection is a blank dispatch list. */
export const hasDispatchRecipients = (selection?: DispatchSelection | null): boolean =>
  !!selection && (selection.everyone || selection.users.length > 0 || selection.groups.length > 0 || selection.roles.length > 0 || selection.units.length > 0);

/** The values a call form holds for the policy fields it renders. */
export interface CallFormFieldInputs {
  note?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  what3words?: string;
  plusCode?: string;
  contactName?: string;
  contactInfo?: string;
  externalId?: string;
  incidentId?: string;
  referenceId?: string;
  /** Scheduled dispatch time as an ISO UTC string, or '' for none. */
  dispatchOn?: string;
  destinationPoiId?: string | number | null;
  dispatchSelection?: DispatchSelection | null;
}

/** What the new-call form will submit, keyed for useNewCallFieldPolicy().missingRequired. */
export const getNewCallFieldValues = (inputs: CallFormFieldInputs): Partial<Record<NewCallFieldKey, unknown>> => ({
  [NewCallFieldKeys.Note]: inputs.note,
  [NewCallFieldKeys.Address]: inputs.address,
  [NewCallFieldKeys.Geolocation]: formatCallGeolocation(inputs.latitude, inputs.longitude),
  [NewCallFieldKeys.What3Words]: inputs.what3words,
  [NewCallFieldKeys.PlusCode]: inputs.plusCode,
  [NewCallFieldKeys.ContactName]: inputs.contactName,
  [NewCallFieldKeys.ContactInfo]: inputs.contactInfo,
  [NewCallFieldKeys.ExternalId]: inputs.externalId,
  [NewCallFieldKeys.IncidentId]: inputs.incidentId,
  [NewCallFieldKeys.ReferenceId]: inputs.referenceId,
  [NewCallFieldKeys.DispatchOn]: inputs.dispatchOn,
  [NewCallFieldKeys.DestinationPoi]: inputs.destinationPoiId,
  [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(inputs.dispatchSelection),
});

/** The stored call values an edit falls back to. */
export interface StoredCallFieldValues {
  Note?: string | null;
  Address?: string | null;
  Geolocation?: string | null;
  What3Words?: string | null;
  ContactName?: string | null;
  ContactInfo?: string | null;
  ExternalId?: string | null;
  IncidentId?: string | null;
  ReferenceId?: string | null;
}

const keepStored = (input: string | undefined, stored: string | null | undefined): string => (input && input.trim() ? input : (stored ?? ''));

/**
 * The call as an edit will leave it, keyed for missingRequired. EditCall keeps the stored value for a blank text
 * input, so a field is only missing when both the input and the stored value are blank — which is exactly what the
 * server checks. The destination is the exception: the posted id replaces the stored one, and none clears it.
 */
export const getEditCallFieldValues = (inputs: CallFormFieldInputs, stored: StoredCallFieldValues): Partial<Record<NewCallFieldKey, unknown>> => {
  const postedPoint = formatCallGeolocation(inputs.latitude, inputs.longitude);

  return {
    [NewCallFieldKeys.Note]: keepStored(inputs.note, stored.Note),
    [NewCallFieldKeys.Address]: keepStored(inputs.address, stored.Address),
    [NewCallFieldKeys.Geolocation]: postedPoint || (isCallGeolocation(stored.Geolocation) ? stored.Geolocation : ''),
    [NewCallFieldKeys.What3Words]: keepStored(inputs.what3words, stored.What3Words),
    // A plus code is only a way to find a location; it is never stored, so there is nothing to fall back to.
    [NewCallFieldKeys.PlusCode]: inputs.plusCode,
    [NewCallFieldKeys.ContactName]: keepStored(inputs.contactName, stored.ContactName),
    [NewCallFieldKeys.ContactInfo]: keepStored(inputs.contactInfo, stored.ContactInfo),
    [NewCallFieldKeys.ExternalId]: keepStored(inputs.externalId, stored.ExternalId),
    [NewCallFieldKeys.IncidentId]: keepStored(inputs.incidentId, stored.IncidentId),
    [NewCallFieldKeys.ReferenceId]: keepStored(inputs.referenceId, stored.ReferenceId),
    [NewCallFieldKeys.DestinationPoi]: inputs.destinationPoiId,
    [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(inputs.dispatchSelection),
  };
};

/**
 * Narrows missingRequired() to what a call form here can enforce: the fields it renders (CALL_FORM_FIELDS).
 * A pending call has not been sent yet, so neither who gets it nor when can be required of it (the server skips
 * both for pending calls too). An edit never requires a dispatch time: it only means something before a call
 * goes out, and the API cannot clear one anyway.
 */
export const getEnforcedMissingCallFields = (missing: readonly NewCallFieldKey[], options: { isPending?: boolean; isEdit?: boolean } = {}): NewCallFieldKey[] =>
  missing.filter((key) => {
    if (!CALL_FORM_FIELDS.has(key)) {
      return false;
    }

    if (options.isPending && (key === NewCallFieldKeys.DispatchList || key === NewCallFieldKeys.DispatchOn)) {
      return false;
    }

    return !(options.isEdit && key === NewCallFieldKeys.DispatchOn);
  });

/** A scheduled dispatch must be at least this far ahead when it is set — the web form applies the same rule. */
export const DISPATCH_ON_MIN_LEAD_MINUTES = 15;

/**
 * The stored dispatch time (CallResultData.DispatchedOnUtc). Some call result times come back without a zone;
 * they are UTC all the same. Null when blank or unparseable.
 */
export const parseCallDispatchOnUtc = (value?: string | null): Date | null => {
  if (!value || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed}Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * What the edit form's dispatch time starts with: the stored time while it is still ahead (the call is scheduled
 * and has not gone out), else '' — a time in the past is when the call was sent, not something to edit.
 */
export const getScheduledDispatchPrefill = (dispatchedOnUtc?: string | null, now: Date = new Date()): string => {
  const scheduled = parseCallDispatchOnUtc(dispatchedOnUtc);

  return scheduled && scheduled.getTime() > now.getTime() ? scheduled.toISOString() : '';
};

/** True when a chosen dispatch time is less than DISPATCH_ON_MIN_LEAD_MINUTES ahead (or unreadable). */
export const isDispatchOnTooSoon = (dispatchOn: string, now: Date = new Date()): boolean => {
  const chosen = parseCallDispatchOnUtc(dispatchOn);

  return !chosen || chosen.getTime() < now.getTime() + DISPATCH_ON_MIN_LEAD_MINUTES * 60 * 1000;
};
