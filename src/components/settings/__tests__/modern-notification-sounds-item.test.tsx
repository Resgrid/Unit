import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ModernNotificationSoundsItem } from '../modern-notification-sounds-item';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.modern_notification_sounds': 'Modern Notification Sounds',
        'settings.modern_notification_sounds_description': 'Use the new modern sound set for push notifications.',
      };
      return translations[key] || key;
    },
  }),
}));

// Control the platform per test (component is Android-only).
let mockIsAndroid = true;
jest.mock('@/lib/platform', () => ({
  get isAndroid() {
    return mockIsAndroid;
  },
}));

// Control the preference hook.
const mockSetModernSoundsEnabled = jest.fn();
let mockIsModernSoundsEnabled = true;
jest.mock('@/lib/hooks/use-modern-notification-sounds', () => ({
  useModernNotificationSounds: () => ({
    isModernSoundsEnabled: mockIsModernSoundsEnabled,
    setModernSoundsEnabled: mockSetModernSoundsEnabled,
  }),
}));

describe('ModernNotificationSoundsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAndroid = true;
    mockIsModernSoundsEnabled = true;
  });

  it('renders the label and description on Android', () => {
    render(<ModernNotificationSoundsItem />);

    expect(screen.getByText('Modern Notification Sounds')).toBeTruthy();
    expect(screen.getByText('Use the new modern sound set for push notifications.')).toBeTruthy();
  });

  it('renders nothing on non-Android platforms', () => {
    mockIsAndroid = false;

    render(<ModernNotificationSoundsItem />);

    expect(screen.queryByText('Modern Notification Sounds')).toBeNull();
  });

  it('reflects the enabled state on the switch', () => {
    mockIsModernSoundsEnabled = true;

    render(<ModernNotificationSoundsItem />);

    expect(screen.getByRole('switch').props.value).toBe(true);
  });

  it('calls the setter when toggled off', () => {
    mockIsModernSoundsEnabled = true;

    render(<ModernNotificationSoundsItem />);

    fireEvent(screen.getByRole('switch'), 'valueChange', false);

    expect(mockSetModernSoundsEnabled).toHaveBeenCalledWith(false);
  });
});
