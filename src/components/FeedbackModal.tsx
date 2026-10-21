import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Star } from 'lucide-react';
import { useCreateFeedback } from '../hooks/api/useFeedback';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const [score, setScore] = useState<number>(0);
  const [hoveredScore, setHoveredScore] = useState<number>(0);
  const [feedbackContent, setFeedbackContent] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createFeedback = useCreateFeedback();
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isOpen) return;
    
    // Prevenir scroll do body quando modal estiver aberto
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

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setScore(0);
      setHoveredScore(0);
      setFeedbackContent('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (score === 0) {
      showError(t.feedbackError);
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createFeedback.mutateAsync({
        score,
        feedbackContent: feedbackContent.trim() || undefined,
      });
      
      success(t.feedbackSuccess);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar feedback';
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        {/* Modal Card */}
        <div 
          className="relative w-full sm:w-96 max-w-md p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-content">
              {t.feedbackTitle}
            </h3>
            <button
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Star Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-content-secondary mb-3">
                {t.feedbackRatingLabel}
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = starValue <= (hoveredScore || score);
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => setScore(starValue)}
                      onMouseEnter={() => setHoveredScore(starValue)}
                      onMouseLeave={() => setHoveredScore(0)}
                      className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
                      aria-label={`${starValue} estrela${starValue > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          isFilled
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300 dark:text-gray-600 fill-gray-300 dark:fill-gray-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback Text */}
            <div className="mb-6">
              <label 
                htmlFor="feedback-content"
                className="block text-sm font-medium text-content-secondary mb-2"
              >
                {t.feedbackCommentLabel}
              </label>
              <textarea
                id="feedback-content"
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full px-3 py-2 border border-line rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-surface-elevated text-content"
                placeholder={t.feedbackPlaceholder}
              />
              <p className="mt-1 text-xs text-content-tertiary">
                {feedbackContent.length}/5000 caracteres
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || score === 0}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
              >
                {isSubmitting ? t.feedbackSubmitting : t.feedbackSubmit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
