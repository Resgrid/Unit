import { useRecordsStore } from '@/stores/records/store';
import { definitionTermKey, recordTypeTermKey, useTerm } from '@/stores/terminology/store';

// A built-in definition's key, else its legacy record type number (a legacy record may carry only the number). A
// department definition never falls back to the number: its own name is the catalog's, not a built-in type's.
const termKeyFor = (definitionKey?: string | null, recordType?: number | null) => (definitionKey ? definitionTermKey(definitionKey) : recordTypeTermKey(recordType));

/** Non-reactive: a record type's name as the department calls it, else `fallback` (the catalog's own name). */
export const recordTypeName = (names: Record<string, string>, definitionKey: string | null | undefined, recordType: number | null | undefined, fallback: string): string => {
  const key = termKeyFor(definitionKey, recordType);
  return (key ? names[key] : undefined) || fallback;
};

/** Reactive: the department's name for a record's type, else the catalog's; null when neither is known. */
export const useRecordTypeName = (definitionKey?: string | null, recordType?: number | null): string | null => {
  const catalogName = useRecordsStore((state) => (definitionKey ? state.entryFor(definitionKey)?.Name : undefined));
  return useTerm(termKeyFor(definitionKey, recordType), catalogName ?? '') || null;
};
