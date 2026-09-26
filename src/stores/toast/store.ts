import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'muted';

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastStore {
  toasts: ToastMessage[];
  /**
   * Toast hosts mounted inside native Modal windows, in the order they opened. A native Modal is its
   * own window, so toasts drawn in the app window sit underneath it; while any of these exist the
   * toasts render in the most recently opened one instead of the app window.
   */
  modalHosts: string[];
  showToast: (type: ToastType, message: string, title?: string) => void;
  removeToast: (id: string) => void;
  registerModalHost: (hostId: string) => void;
  unregisterModalHost: (hostId: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  modalHosts: [],
  showToast: (type, message, title) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, title }],
    }));
    // Auto remove toast after 3 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    }, 3000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  registerModalHost: (hostId) => {
    set((state) => (state.modalHosts.includes(hostId) ? state : { modalHosts: [...state.modalHosts, hostId] }));
  },
  unregisterModalHost: (hostId) => {
    set((state) => ({
      modalHosts: state.modalHosts.filter((id) => id !== hostId),
    }));
  },
}));
