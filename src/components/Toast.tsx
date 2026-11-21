// Kurze Hinweis-Leiste unten am Bildschirm, optional mit „Rückgängig“-Knopf.
// Statt Bestätigungsdialogen (SPEC Abschnitt 9) wird hier Rückgängig angeboten.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  undo?: () => void | Promise<void>;
  /** Anzeigedauer in ms (Standard 5 s) */
  duration?: number;
  error?: boolean;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, opts?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, opts: ToastOptions = {}) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, ...opts });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), opts.duration ?? 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.error ? 'toast-error' : ''}`} role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="toast-undo"
              onClick={async () => {
                const undo = toast.undo!;
                setToast(null);
                await undo();
              }}
            >
              Rückgängig
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
