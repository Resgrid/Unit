import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VStack } from '@/components/ui/vstack';

import { useToastStore } from '../../stores/toast/store';
import { ToastMessage } from './toast';

// gluestack overlays (Actionsheet, Modal, Drawer…) render at zIndex 9999 on web; toasts must clear them.
const TOAST_LAYER_Z_INDEX = 10000;

interface ToastContainerProps {
  /**
   * 'root' is the app-window host, mounted once in the root layout above every portal overlay.
   * 'modal' is a host inside a native Modal window (use ModalToastHost); while one is mounted the
   * root host yields to the most recently opened one, since the app window is underneath it.
   */
  placement?: 'root' | 'modal';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ placement = 'root' }) => {
  const modalHostId = React.useId();
  const isModalHost = placement === 'modal';
  const registerModalHost = useToastStore((state) => state.registerModalHost);
  const unregisterModalHost = useToastStore((state) => state.unregisterModalHost);
  const isActiveHost = useToastStore((state) => (isModalHost ? state.modalHosts[state.modalHosts.length - 1] === modalHostId : state.modalHosts.length === 0));
  const toasts = useToastStore((state) => state.toasts);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (!isModalHost) {
      return;
    }

    registerModalHost(modalHostId);
    return () => unregisterModalHost(modalHostId);
  }, [isModalHost, modalHostId, registerModalHost, unregisterModalHost]);

  if (!isActiveHost || toasts.length === 0) {
    return null;
  }

  // Position below status bar and navigation header
  // Use a larger offset to ensure toasts appear below any navigation content
  const topOffset = insets.top + 70; // Status bar height + generous navigation header height

  return (
    <VStack className="absolute inset-x-0 px-4" space="sm" style={{ top: topOffset, zIndex: TOAST_LAYER_Z_INDEX }} pointerEvents="box-none" testID={isModalHost ? 'modal-toast-host' : 'toast-host'}>
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} {...toast} />
      ))}
    </VStack>
  );
};

/**
 * Toast host for a native Modal window (a native Modal is its own window, so toasts drawn in the app
 * window sit underneath it). Render it as the last child of the Modal's content so it draws on top.
 * NativeModal includes one already.
 */
export const ModalToastHost: React.FC = () => <ToastContainer placement="modal" />;
