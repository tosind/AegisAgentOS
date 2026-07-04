"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
      }, toast.duration - 200);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const colors = {
    success: "border-[#9dffb5] bg-[#9dffb5]/10",
    error: "border-[#ff8a61] bg-[#ff8a61]/10",
    warning: "border-[#fab005] bg-[#fab005]/10",
    info: "border-[#ffac02] bg-[#ffac02]/10",
  };

  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-none border backdrop-blur-md shadow-lg transition-all duration-200 ${
        colors[toast.type]
      } ${exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}
    >
      <span className="text-sm font-bold">{icons[toast.type]}</span>
      <span className="text-sm flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="text-[#9b8460] hover:text-white transition-colors text-xs"
      >
        ✕
      </button>
    </div>
  );
}
