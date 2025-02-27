import { create } from 'zustand';
import { getCall, getCallExtraData } from '@/api/calls/calls';
import { CallResult } from '@/models/v4/calls/callResult';
import { CallExtraDataResult } from '@/models/v4/calls/callExtraDataResult';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { CallExtraDataResultData } from '@/models/v4/calls/callExtraDataResultData';

interface CallDetailState {
  call: CallResultData | null;
  callExtraData: CallExtraDataResultData | null;
  isLoading: boolean;
  error: string | null;
  fetchCallDetail: (callId: string) => Promise<void>;
  reset: () => void;
}

export const useCallDetailStore = create<CallDetailState>((set) => ({
  call: null,
  callExtraData: null,
  isLoading: false,
  error: null,
  reset: () =>
    set({ call: null, callExtraData: null, isLoading: false, error: null }),
  fetchCallDetail: async (callId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [callResult, callExtraDataResult] = await Promise.all([
        getCall(callId),
        getCallExtraData(callId),
      ]);

      if (
        callResult &&
        callResult.Data &&
        callExtraDataResult &&
        callExtraDataResult.Data
      ) {
        set({
          call: callResult.Data,
          callExtraData: callExtraDataResult.Data,
          isLoading: false,
        });
      } else {
        set({
          error:
            callResult.Message ||
            callExtraDataResult.Message ||
            'Failed to fetch call details',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
      });
    }
  },
}));
