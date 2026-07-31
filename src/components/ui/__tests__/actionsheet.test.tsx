import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

const mockUIActionsheet = jest.fn();

jest.mock('@gluestack-ui/core/actionsheet/creator', () => ({
  createActionsheet: () => {
    const mockReact = require('react');

    const Root = (props: any) => {
      mockUIActionsheet(props);
      return mockReact.createElement(mockReact.Fragment, null, props.children);
    };

    const passthrough = (props: any) => mockReact.createElement(mockReact.Fragment, null, props.children);

    Root.Content = passthrough;
    Root.Item = passthrough;
    Root.ItemText = passthrough;
    Root.DragIndicator = passthrough;
    Root.DragIndicatorWrapper = passthrough;
    Root.Backdrop = passthrough;
    Root.ScrollView = passthrough;
    Root.VirtualizedList = passthrough;
    Root.FlatList = passthrough;
    Root.SectionList = passthrough;
    Root.SectionHeaderText = passthrough;
    Root.Icon = passthrough;

    return Root;
  },
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: jest.fn(() => ({ colorScheme: 'light' })),
}));

import { Actionsheet } from '../actionsheet';

const lastCloseOnOverlayClick = () => mockUIActionsheet.mock.calls[mockUIActionsheet.mock.calls.length - 1][0].closeOnOverlayClick;

describe('Actionsheet backdrop guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUIActionsheet.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The backdrop mounts full-screen the instant isOpen flips, so the tap that opened the
  // sheet could land on it and close the sheet again.
  it('keeps overlay-click dismissal disabled immediately after opening', () => {
    const { unmount } = render(
      <Actionsheet isOpen={true}>
        <Text>content</Text>
      </Actionsheet>
    );

    expect(lastCloseOnOverlayClick()).toBe(false);

    unmount();
  });

  it('arms overlay-click dismissal once the open animation window has passed', () => {
    const { unmount } = render(
      <Actionsheet isOpen={true}>
        <Text>content</Text>
      </Actionsheet>
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(lastCloseOnOverlayClick()).toBe(true);

    unmount();
  });

  it('re-disarms when the sheet closes so the next open is guarded again', () => {
    const { rerender, unmount } = render(
      <Actionsheet isOpen={true}>
        <Text>content</Text>
      </Actionsheet>
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(lastCloseOnOverlayClick()).toBe(true);

    rerender(
      <Actionsheet isOpen={false}>
        <Text>content</Text>
      </Actionsheet>
    );
    expect(lastCloseOnOverlayClick()).toBe(false);

    rerender(
      <Actionsheet isOpen={true}>
        <Text>content</Text>
      </Actionsheet>
    );
    expect(lastCloseOnOverlayClick()).toBe(false);

    unmount();
  });

  it('never arms overlay-click dismissal when the caller opted out', () => {
    const { unmount } = render(
      <Actionsheet isOpen={true} closeOnOverlayClick={false}>
        <Text>content</Text>
      </Actionsheet>
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(lastCloseOnOverlayClick()).toBe(false);

    unmount();
  });

  it('leaves uncontrolled sheets armed since they have no isOpen to gate on', () => {
    const { unmount } = render(
      <Actionsheet defaultIsOpen={true}>
        <Text>content</Text>
      </Actionsheet>
    );

    expect(lastCloseOnOverlayClick()).toBe(true);

    unmount();
  });
});
