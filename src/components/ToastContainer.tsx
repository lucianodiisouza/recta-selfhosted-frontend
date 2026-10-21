import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };

  // Tinted icon on an elevated card, like the iOS Toast.
  const tints = {
    success: 'bg-positive-soft text-positive',
    error: 'bg-negative-soft text-negative-on-soft',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
  };

  const Icon = icons[toast.type];

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-surface-elevated/95 backdrop-blur-xl p-3 pe-2 shadow-floating ring-1 ring-line-subtle animate-toast-in"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tints[toast.type]}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="flex-1 text-[15px] font-medium text-content">{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Fechar notificação"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-content-tertiary hover:bg-surface-sunken hover:text-content transition-colors"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[110] mx-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:end-4 sm:mx-0 sm:w-full" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

