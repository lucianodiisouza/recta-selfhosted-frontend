import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCreateHousehold } from '../hooks/api/useHouseholds';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';

type CreateHouseholdFormData = { name: string };

interface CreateHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateHouseholdModal({ isOpen, onClose }: CreateHouseholdModalProps) {
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();
  const createHousehold = useCreateHousehold();

  const createHouseholdSchema = z.object({
    name: z.string().min(1, t.nameRequired).max(100, t.nameTooLong),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateHouseholdFormData>({
    resolver: zodResolver(createHouseholdSchema),
  });

  const onSubmit = async (data: CreateHouseholdFormData) => {
    try {
      const newHousehold = await createHousehold.mutateAsync(data);
      success(t.sharedHouseholdCreated);
      
      // Track analytics
      analyticsHelpers.logHouseholdCreated();
      
      // Save the new household to localStorage and switch to it immediately
      // The custom event will trigger useDefaultHousehold to update automatically
      if (newHousehold?.id) {
        const { saveHouseholdToLocalStorage } = await import('../utils/householdStorage');
        saveHouseholdToLocalStorage(newHousehold.id, newHousehold.name, 'OWNER');
        // No reload needed - React Query will refetch automatically when householdId changes
        // The TransactionsContext will use the new householdId from useDefaultHousehold
      }
      
      reset();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || t.errorCreatingSharedHousehold;
      showError(errorMessage);
    }
  };

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Renderizar no portal para aparecer no root
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto" onClick={handleBackdropClick}>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
            aria-hidden="true"
          />

          {/* Scrollable Container */}
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
            {/* Modal Card */}
            <div 
              className="relative w-full sm:w-[500px] max-w-lg p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-line-subtle">
                <h3 className="font-rounded text-lg font-semibold text-content">
                  {t.createSharedHousehold}
                </h3>
                <button
                  onClick={onClose}
                  className="text-content-tertiary hover:opacity-70 transition-opacity p-1"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-light text-content-tertiary mb-2">
                    {t.householdNameLabel}
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    id="name"
                    className="w-full px-3 py-2.5 border border-line-subtle rounded-lg bg-surface-elevated text-content focus:outline-none focus:border-brand font-light tracking-tight"
                    placeholder={t.householdNamePlaceholder}
                    autoFocus
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm font-light text-negative">{errors.name.message}</p>
                  )}
                </div>

                <div className="border border-info/25 rounded-lg p-3">
                  <p className="text-sm font-light text-info">
                    {t.youCanInviteAnotherPerson}
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-line-subtle">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
                  >
                    {isSubmitting ? t.creating : t.create}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
    document.body
  );
}
