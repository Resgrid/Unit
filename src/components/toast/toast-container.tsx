import React from 'react';
import { ToastMessage } from './toast';
import { useToastStore } from '../../stores/toast/store';
import { VStack } from '@/components/ui/vstack';
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <VStack
      className="absolute top-0 left-0 right-0 z-50 pt-safe-top"
      space="sm"
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} {...toast} />
      ))}
    </VStack>
  );
};
