import React from 'react';
import { Modal, type ModalProps } from 'react-native';

import { ModalToastHost } from '@/components/toast/toast-container';

/**
 * React Native's Modal with a toast host inside it. Use it instead of importing Modal from
 * 'react-native' directly.
 *
 * A native Modal is its own window above the app, so toasts drawn in the app window — every error
 * or confirmation shown while the modal is open — sit underneath it where nobody sees them.
 */
export const NativeModal: React.FC<ModalProps> = ({ children, ...props }) => (
  <Modal {...props}>
    {children}
    <ModalToastHost />
  </Modal>
);
