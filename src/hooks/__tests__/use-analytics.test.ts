import { renderHook } from '@testing-library/react-native';

import { aptabaseService } from '@/services/aptabase.service';

import { useAnalytics } from '../use-analytics';

jest.mock('@/services/aptabase.service', () => ({
  aptabaseService: {
    trackEvent: jest.fn(),
  },
}));

describe('useAnalytics', () => {
  const mockAptabaseService = aptabaseService as jest.Mocked<typeof aptabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide trackEvent function', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.trackEvent).toBeDefined();
    expect(typeof result.current.trackEvent).toBe('function');
  });

  it('should call aptabaseService.trackEvent with correct parameters', () => {
    const { result } = renderHook(() => useAnalytics());

    const eventName = 'test_event';
    const properties = { prop1: 'value1', prop2: 42 };

    result.current.trackEvent(eventName, properties);

    expect(mockAptabaseService.trackEvent).toHaveBeenCalledWith(eventName, properties);
    expect(mockAptabaseService.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('should call aptabaseService.trackEvent without properties', () => {
    const { result } = renderHook(() => useAnalytics());

    const eventName = 'simple_event';

    result.current.trackEvent(eventName);

    expect(mockAptabaseService.trackEvent).toHaveBeenCalledWith(eventName, undefined);
    expect(mockAptabaseService.trackEvent).toHaveBeenCalledTimes(1);
  });

  it('should maintain stable reference to trackEvent function', () => {
    const { result, rerender } = renderHook(() => useAnalytics());

    const firstTrackEvent = result.current.trackEvent;

    rerender({});

    const secondTrackEvent = result.current.trackEvent;

    expect(firstTrackEvent).toBe(secondTrackEvent);
  });
});
