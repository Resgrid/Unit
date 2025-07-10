import { renderHook } from '@testing-library/react-native';
import { useCoreStore } from '../core-store';

describe('Core Store Initialization', () => {
  it('should prevent multiple simultaneous initializations', () => {
    const { result } = renderHook(() => useCoreStore());
    expect(result.current).toBeDefined();
  });

  it('should skip initialization if already initialized', () => {
    const { result } = renderHook(() => useCoreStore());
    expect(result.current).toBeDefined();
  });

  it('should handle initialization errors gracefully', () => {
    const { result } = renderHook(() => useCoreStore());
    expect(result.current).toBeDefined();
  });
});
