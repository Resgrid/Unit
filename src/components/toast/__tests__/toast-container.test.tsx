import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useToastStore } from '@/stores/toast/store';

import { ModalToastHost, ToastContainer } from '../toast-container';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({
    top: 44,
    bottom: 0,
    left: 0,
    right: 0,
  })),
}));

// Mock the ToastMessage component
jest.mock('../toast', () => ({
  ToastMessage: ({ type, message, title }: any) => {
    const { Text } = require('react-native');
    return (
      <Text testID={`toast-${type}`}>
        {title && `${title}: `}
        {message}
      </Text>
    );
  },
}));

const setToasts = (toasts: { id: string; type: 'success' | 'error' | 'warning' | 'info' | 'muted'; message: string; title?: string }[]) => {
  act(() => useToastStore.setState({ toasts }));
};

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [], modalHosts: [] });
  });

  it('renders nothing when no toasts are present', () => {
    const { queryByTestId } = render(<ToastContainer />);

    expect(queryByTestId('toast-host')).toBeNull();
    expect(queryByTestId('toast-success')).toBeNull();
    expect(queryByTestId('toast-error')).toBeNull();
  });

  it('renders toasts when they are present in the store', () => {
    setToasts([
      { id: '1', type: 'success', message: 'Success message' },
      { id: '2', type: 'error', message: 'Error message', title: 'Error Title' },
    ]);

    const { getByTestId } = render(<ToastContainer />);

    expect(getByTestId('toast-success')).toBeTruthy();
    expect(getByTestId('toast-error')).toBeTruthy();
  });

  it('renders toast with title and message correctly', () => {
    setToasts([{ id: '1', type: 'warning', message: 'Warning message', title: 'Warning Title' }]);

    const { getByTestId } = render(<ToastContainer />);

    const toastElement = getByTestId('toast-warning');
    expect(toastElement.props.children).toEqual(['Warning Title: ', 'Warning message']);
  });

  it('draws above gluestack overlays, which sit at zIndex 9999 on web', () => {
    setToasts([{ id: '1', type: 'error', message: 'Could not save' }]);

    render(<ToastContainer />);

    const layerStyle = [screen.getByTestId('toast-host').props.style].flat(Infinity).reduce((merged: Record<string, unknown>, style) => ({ ...merged, ...(style as object) }), {});
    expect(layerStyle.zIndex).toBeGreaterThan(9999);
    expect(layerStyle.top).toBe(44 + 70);
  });

  // A native Modal is its own window above the app, so the app-window host cannot be seen while one
  // is open; toasts have to render inside the topmost modal window instead.
  describe('inside native Modal windows', () => {
    const App = ({ openModals }: { openModals: number }) => (
      <>
        <ToastContainer />
        {openModals >= 1 ? <ModalToastHost key="sheet" /> : null}
        {openModals >= 2 ? <ModalToastHost key="picker" /> : null}
      </>
    );

    it('moves toasts into the modal while it is open and back to the app when it closes', () => {
      setToasts([{ id: '1', type: 'error', message: 'Error saving role assignments' }]);
      const { rerender } = render(<App openModals={0} />);
      expect(screen.getByTestId('toast-host')).toBeTruthy();

      rerender(<App openModals={1} />);

      expect(screen.queryByTestId('toast-host')).toBeNull();
      expect(screen.getAllByTestId('modal-toast-host')).toHaveLength(1);
      expect(screen.getAllByTestId('toast-error')).toHaveLength(1);

      rerender(<App openModals={0} />);

      expect(screen.getByTestId('toast-host')).toBeTruthy();
      expect(screen.queryByTestId('modal-toast-host')).toBeNull();
      expect(useToastStore.getState().modalHosts).toEqual([]);
    });

    it('renders in the most recently opened modal only', () => {
      setToasts([{ id: '1', type: 'info', message: 'Heads up' }]);
      const { rerender } = render(<App openModals={1} />);
      const sheetHostId = useToastStore.getState().modalHosts[0];

      rerender(<App openModals={2} />);

      expect(useToastStore.getState().modalHosts).toHaveLength(2);
      expect(screen.getAllByTestId('modal-toast-host')).toHaveLength(1);
      expect(screen.getAllByTestId('toast-info')).toHaveLength(1);

      // Closing the picker hands toasts back to the sheet underneath it.
      rerender(<App openModals={1} />);

      expect(useToastStore.getState().modalHosts).toEqual([sheetHostId]);
      expect(screen.getAllByTestId('modal-toast-host')).toHaveLength(1);
      expect(screen.queryByTestId('toast-host')).toBeNull();
    });
  });
});
