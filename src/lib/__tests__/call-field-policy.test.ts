import { AxiosError, AxiosHeaders } from 'axios';

import {
  CALL_FIELD_LABEL_KEYS,
  formatCallFieldLabels,
  formatCallGeolocation,
  getEditCallFieldValues,
  getEnforcedMissingCallFields,
  getMissingRequiredCallFields,
  getNewCallFieldValues,
  getScheduledDispatchPrefill,
  hasDispatchRecipients,
  isCallGeolocation,
  isDispatchOnTooSoon,
  isPendingCallState,
  parseCallDispatchOnUtc,
} from '@/lib/call-field-policy';
import { NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

const NO_DISPATCH = { everyone: false, users: [], groups: [], roles: [], units: [] };

const axiosError = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };

  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, { status, statusText: '', data, headers: {}, config });
};

describe('call field policy helpers', () => {
  describe('labels', () => {
    it('has a label for every policy key', () => {
      for (const key of Object.values(NewCallFieldKeys)) {
        expect(CALL_FIELD_LABEL_KEYS[key]).toBeTruthy();
      }
    });

    it('formats keys as labels, matching case-insensitively and keeping unknown keys as they are', () => {
      const translate = (labelKey: string) => `[${labelKey}]`;

      expect(formatCallFieldLabels(['contactName', 'GEOLOCATION', 'somethingNew'], translate)).toBe('[calls.contact_name], [calls.coordinates], somethingNew');
    });
  });

  describe('getMissingRequiredCallFields', () => {
    it('reads the keys from the server rejection', () => {
      expect(getMissingRequiredCallFields(axiosError(400, 'Required call fields are missing: address, contactInfo'))).toEqual(['address', 'contactInfo']);
    });

    it('accepts the message wrapped in a JSON body', () => {
      expect(getMissingRequiredCallFields(axiosError(400, { Message: 'Required call fields are missing: incidentId' }))).toEqual(['incidentId']);
    });

    it('ignores other failures', () => {
      expect(getMissingRequiredCallFields(axiosError(400, 'LinkedCallId is not another call’s id.'))).toBeNull();
      expect(getMissingRequiredCallFields(axiosError(500, 'Required call fields are missing: address'))).toBeNull();
      expect(getMissingRequiredCallFields(new Error('Required call fields are missing: address'))).toBeNull();
      expect(getMissingRequiredCallFields(axiosError(400, 'Required call fields are missing: '))).toBeNull();
    });
  });

  describe('geolocation', () => {
    it('formats a usable point and blanks anything the server would not take as a location', () => {
      expect(formatCallGeolocation(51.5, -0.12)).toBe('51.5,-0.12');
      // A single zero coordinate is a real place on the equator or the prime meridian.
      expect(formatCallGeolocation(0, 32.5)).toBe('0,32.5');
      expect(formatCallGeolocation(0, 0)).toBe('');
      expect(formatCallGeolocation(undefined, 4)).toBe('');
      expect(formatCallGeolocation(Number.NaN, 4)).toBe('');
      expect(formatCallGeolocation(95, 4)).toBe('');
    });

    it('reads a stored point by the same rule', () => {
      expect(isCallGeolocation('51.5,-0.12')).toBe(true);
      expect(isCallGeolocation(' 51.5 , -0.12 ')).toBe(true);
      expect(isCallGeolocation(',')).toBe(false);
      expect(isCallGeolocation('0,0')).toBe(false);
      expect(isCallGeolocation('')).toBe(false);
      expect(isCallGeolocation(null)).toBe(false);
      expect(isCallGeolocation('1,2,3')).toBe(false);
    });
  });

  it('recognises a pending call whether State arrives as a number or a string', () => {
    expect(isPendingCallState(8)).toBe(true);
    expect(isPendingCallState('8')).toBe(true);
    expect(isPendingCallState(0)).toBe(false);
    expect(isPendingCallState('')).toBe(false);
    expect(isPendingCallState(undefined)).toBe(false);
  });

  it('treats an empty dispatch selection as no recipients', () => {
    expect(hasDispatchRecipients(NO_DISPATCH)).toBe(false);
    expect(hasDispatchRecipients(null)).toBe(false);
    expect(hasDispatchRecipients({ ...NO_DISPATCH, everyone: true })).toBe(true);
    expect(hasDispatchRecipients({ ...NO_DISPATCH, units: ['7'] })).toBe(true);
  });

  describe('getNewCallFieldValues', () => {
    it('keys what the new-call form submits', () => {
      const values = getNewCallFieldValues({
        note: 'n',
        address: 'a',
        latitude: 0,
        longitude: 0,
        what3words: 'w.w.w',
        plusCode: '',
        contactName: 'Jo',
        contactInfo: '555',
        externalId: 'CAD-1',
        incidentId: '',
        referenceId: 'R-9',
        destinationPoiId: '12',
        dispatchSelection: NO_DISPATCH,
      });

      expect(values).toEqual({
        [NewCallFieldKeys.Note]: 'n',
        [NewCallFieldKeys.Address]: 'a',
        [NewCallFieldKeys.Geolocation]: '',
        [NewCallFieldKeys.What3Words]: 'w.w.w',
        [NewCallFieldKeys.PlusCode]: '',
        [NewCallFieldKeys.ContactName]: 'Jo',
        [NewCallFieldKeys.ContactInfo]: '555',
        [NewCallFieldKeys.ExternalId]: 'CAD-1',
        [NewCallFieldKeys.IncidentId]: '',
        [NewCallFieldKeys.ReferenceId]: 'R-9',
        [NewCallFieldKeys.DestinationPoi]: '12',
        [NewCallFieldKeys.DispatchList]: false,
      });
    });
  });

  describe('getEditCallFieldValues', () => {
    const stored = {
      Note: 'stored note',
      Address: '',
      Geolocation: '51.5,-0.12',
      What3Words: 'stored.three.words',
      ContactName: '',
      ContactInfo: 'stored info',
      ExternalId: 'CAD-1',
      IncidentId: '',
      ReferenceId: '',
    };

    it('falls back to the stored value for a blank input, as EditCall does', () => {
      const values = getEditCallFieldValues({ note: '  ', address: '', contactName: '', contactInfo: '', what3words: '', dispatchSelection: NO_DISPATCH }, stored);

      expect(values[NewCallFieldKeys.Note]).toBe('stored note');
      expect(values[NewCallFieldKeys.Address]).toBe('');
      expect(values[NewCallFieldKeys.What3Words]).toBe('stored.three.words');
      expect(values[NewCallFieldKeys.ContactName]).toBe('');
      expect(values[NewCallFieldKeys.ContactInfo]).toBe('stored info');
      expect(values[NewCallFieldKeys.ExternalId]).toBe('CAD-1');
      expect(values[NewCallFieldKeys.IncidentId]).toBe('');
      expect(values[NewCallFieldKeys.DispatchList]).toBe(false);
    });

    it('takes a filled-in identifier over the stored one', () => {
      expect(getEditCallFieldValues({ referenceId: 'R-2' }, stored)[NewCallFieldKeys.ReferenceId]).toBe('R-2');
    });

    it('prefers the posted point and otherwise keeps a usable stored one', () => {
      expect(getEditCallFieldValues({ latitude: 40, longitude: -70 }, stored)[NewCallFieldKeys.Geolocation]).toBe('40,-70');
      expect(getEditCallFieldValues({}, stored)[NewCallFieldKeys.Geolocation]).toBe('51.5,-0.12');
      expect(getEditCallFieldValues({}, { ...stored, Geolocation: ',' })[NewCallFieldKeys.Geolocation]).toBe('');
    });

    it('takes the posted destination as is, since none clears it', () => {
      expect(getEditCallFieldValues({ destinationPoiId: '' }, stored)[NewCallFieldKeys.DestinationPoi]).toBe('');
      expect(getEditCallFieldValues({ destinationPoiId: '9' }, stored)[NewCallFieldKeys.DestinationPoi]).toBe('9');
    });
  });

  describe('getEnforcedMissingCallFields', () => {
    it('only enforces the fields the call forms have an input for', () => {
      expect(
        getEnforcedMissingCallFields([
          NewCallFieldKeys.Address,
          NewCallFieldKeys.ExternalId,
          NewCallFieldKeys.IncidentId,
          NewCallFieldKeys.ReferenceId,
          NewCallFieldKeys.Protocols,
          NewCallFieldKeys.LinkedCall,
          NewCallFieldKeys.DispatchOn,
          NewCallFieldKeys.IndoorLocation,
          NewCallFieldKeys.DispatchList,
        ])
      ).toEqual([NewCallFieldKeys.Address, NewCallFieldKeys.ExternalId, NewCallFieldKeys.IncidentId, NewCallFieldKeys.ReferenceId, NewCallFieldKeys.DispatchOn, NewCallFieldKeys.DispatchList]);
    });

    it('does not require the dispatch list or dispatch time of a pending call', () => {
      expect(getEnforcedMissingCallFields([NewCallFieldKeys.Note, NewCallFieldKeys.DispatchOn, NewCallFieldKeys.DispatchList], { isPending: true })).toEqual([NewCallFieldKeys.Note]);
    });

    it('never requires a dispatch time on an edit', () => {
      expect(getEnforcedMissingCallFields([NewCallFieldKeys.Note, NewCallFieldKeys.DispatchOn, NewCallFieldKeys.DispatchList], { isEdit: true })).toEqual([NewCallFieldKeys.Note, NewCallFieldKeys.DispatchList]);
    });
  });

  describe('scheduled dispatch time', () => {
    const now = new Date('2026-10-08T12:00:00.000Z');

    it('reads a stored time as UTC whether or not it carries a zone', () => {
      expect(parseCallDispatchOnUtc('2026-10-08T14:30:00')?.toISOString()).toBe('2026-10-08T14:30:00.000Z');
      expect(parseCallDispatchOnUtc('2026-10-08T14:30:00Z')?.toISOString()).toBe('2026-10-08T14:30:00.000Z');
      expect(parseCallDispatchOnUtc('2026-10-08T16:30:00+02:00')?.toISOString()).toBe('2026-10-08T14:30:00.000Z');
      expect(parseCallDispatchOnUtc('')).toBeNull();
      expect(parseCallDispatchOnUtc(null)).toBeNull();
      expect(parseCallDispatchOnUtc('not a date')).toBeNull();
    });

    it('prefills the edit form only with a schedule that has not gone out yet', () => {
      expect(getScheduledDispatchPrefill('2026-10-08T14:30:00', now)).toBe('2026-10-08T14:30:00.000Z');
      expect(getScheduledDispatchPrefill('2026-10-08T11:59:00', now)).toBe('');
      // The default a call with no schedule carries.
      expect(getScheduledDispatchPrefill('0001-01-01T00:00:00', now)).toBe('');
      expect(getScheduledDispatchPrefill('', now)).toBe('');
      expect(getScheduledDispatchPrefill(undefined, now)).toBe('');
    });

    it('wants a chosen time at least 15 minutes ahead', () => {
      expect(isDispatchOnTooSoon('2026-10-08T12:14:59.000Z', now)).toBe(true);
      expect(isDispatchOnTooSoon('2026-10-08T12:15:00.000Z', now)).toBe(false);
      expect(isDispatchOnTooSoon('2026-10-08T13:00:00.000Z', now)).toBe(false);
      expect(isDispatchOnTooSoon('2026-10-08T11:00:00.000Z', now)).toBe(true);
      expect(isDispatchOnTooSoon('garbage', now)).toBe(true);
    });
  });
});
