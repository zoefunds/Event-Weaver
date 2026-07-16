/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/** Minimal in-app notification system (toasts), per architecture choice. */

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

const ToastContext = createContext<{ push: (kind: Toast['kind'], message: string) => void }>({
  push: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const colors = {
    success: 'border-tertiary/50 text-tertiary',
    error: 'border-error/50 text-error',
    info: 'border-primary/50 text-primary',
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass rounded-lg border px-4 py-3 text-sm ${colors[t.kind]}`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
