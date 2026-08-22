jest.mock('@dev-plugins/react-query', () => ({
  useReactQueryDevTools: jest.fn(),
}));

import { queryClient } from '../api-provider';

describe('shared QueryClient defaults', () => {
  const defaults = queryClient.getDefaultOptions().queries;

  it('applies a modest stale time instead of refetching on every mount', () => {
    expect(defaults?.staleTime).toBe(30 * 1000);
  });

  it('retries failed queries a bounded number of times', () => {
    expect(defaults?.retry).toBe(2);
  });

  it('does not refetch on window focus', () => {
    // On web/Electron every tab focus would otherwise re-run every mounted query.
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });

  it('leaves per-query options free to override the defaults', () => {
    // Consumers pass their own enabled/queryFn/staleTime; defaults must not be
    // frozen into the client in a way that blocks that.
    const observer = queryClient.defaultQueryOptions({ queryKey: ['x'], staleTime: 0, retry: false });
    expect(observer.staleTime).toBe(0);
    expect(observer.retry).toBe(false);
  });
});
