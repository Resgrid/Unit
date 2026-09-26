import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { useToastStore } from '@/stores/toast/store';

import { NativeModal } from '../native-modal';

jest.mock('@/components/toast/toast', () => ({
  ToastMessage: ({ message }: { message: string }) => {
    const { Text: MockText } = require('react-native');
    return <MockText testID="toast-message">{message}</MockText>;
  },
}));

describe('NativeModal', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [], modalHosts: [] });
  });

  it('renders its content and shows toasts inside the modal window', () => {
    render(
      <NativeModal visible transparent onRequestClose={jest.fn()} testID="native-modal">
        <Text>Sheet content</Text>
      </NativeModal>
    );

    act(() => useToastStore.setState({ toasts: [{ id: '1', type: 'error', message: 'Check-in failed' }] }));

    expect(screen.getByText('Sheet content')).toBeTruthy();
    expect(screen.getByTestId('modal-toast-host')).toBeTruthy();
    expect(screen.getByText('Check-in failed')).toBeTruthy();
    expect(useToastStore.getState().modalHosts).toHaveLength(1);
  });

  it('releases its toast host when it is hidden', () => {
    const { rerender } = render(
      <NativeModal visible onRequestClose={jest.fn()}>
        <Text>Sheet content</Text>
      </NativeModal>
    );
    expect(useToastStore.getState().modalHosts).toHaveLength(1);

    rerender(
      <NativeModal visible={false} onRequestClose={jest.fn()}>
        <Text>Sheet content</Text>
      </NativeModal>
    );

    expect(useToastStore.getState().modalHosts).toEqual([]);
  });
});
