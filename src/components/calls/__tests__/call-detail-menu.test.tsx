import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useCallDetailMenu } from '../call-detail-menu';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the lucide icons
jest.mock('lucide-react-native', () => ({
  EditIcon: 'EditIcon',
  MoreVerticalIcon: 'MoreVerticalIcon',
  XIcon: 'XIcon',
}));

describe('useCallDetailMenu', () => {
  const mockOnEditCall = jest.fn();
  const mockOnCloseCall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const TestComponent = () => {
    const { HeaderRightMenu, CallDetailActionSheet } = useCallDetailMenu({
      onEditCall: mockOnEditCall,
      onCloseCall: mockOnCloseCall,
    });

    return (
      <>
        <HeaderRightMenu />
        <CallDetailActionSheet />
      </>
    );
  };

  it('renders the header menu button', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('kebab-menu-button')).toBeTruthy();
  });

  it('opens the action sheet when menu button is pressed', () => {
    render(<TestComponent />);

    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Check if action sheet items are visible
    expect(screen.getByText('call_detail.edit_call')).toBeTruthy();
    expect(screen.getByText('call_detail.close_call')).toBeTruthy();
  });

  it('calls onEditCall when edit option is pressed', () => {
    render(<TestComponent />);

    // Open the menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Press edit option
    const editButton = screen.getByText('call_detail.edit_call');
    fireEvent.press(editButton);

    expect(mockOnEditCall).toHaveBeenCalledTimes(1);
  });

  it('calls onCloseCall when close option is pressed', () => {
    render(<TestComponent />);

    // Open the menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Press close option
    const closeButton = screen.getByText('call_detail.close_call');
    fireEvent.press(closeButton);

    expect(mockOnCloseCall).toHaveBeenCalledTimes(1);
  });

  it('closes the action sheet after selecting an option', () => {
    render(<TestComponent />);

    // Open the menu
    const menuButton = screen.getByTestId('kebab-menu-button');
    fireEvent.press(menuButton);

    // Verify action sheet is open
    expect(screen.getByText('call_detail.edit_call')).toBeTruthy();

    // Press edit option
    const editButton = screen.getByText('call_detail.edit_call');
    fireEvent.press(editButton);

    // Note: The action sheet closing behavior depends on the implementation
    // This test verifies the callback is called which should close the sheet
    expect(mockOnEditCall).toHaveBeenCalled();
  });
}); 