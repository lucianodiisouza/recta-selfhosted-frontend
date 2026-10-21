import { useI18n } from '../../../context/I18nContext';
import { Copy, Check } from 'lucide-react';

interface OnboardingStep8InviteProps {
  isTransitioning: boolean;
  stepHeadingRef: React.RefObject<HTMLHeadingElement>;
  inviteLink: string;
  linkCopied: boolean;
  onCopyLink: () => void;
  referralLoading: boolean;
}

export const OnboardingStep8Invite = ({
  isTransitioning,
  stepHeadingRef,
  inviteLink,
  linkCopied,
  onCopyLink,
  referralLoading,
}: OnboardingStep8InviteProps) => {
  const { t } = useI18n();

  return (
    <div className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
      <div className="animate-fade-in-up">
        <h3 
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-content mb-2 focus:outline-none"
        >
          {t.onboardingStep8Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep8Description}
        </p>
        
        <div className="animate-fade-in-up animate-delay-200">
          <label htmlFor="inviteLink" className="block text-sm font-medium text-content-secondary mb-2">
            {t.inviteLinkLabel}
          </label>
                    <div className="flex space-x-2">
            <input
              id="inviteLink"
              type="text"
              value={inviteLink}
              readOnly
              placeholder={referralLoading ? t.loading : ''}
              className="flex-1 px-4 py-3 border border-line rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700 text-content transition-all duration-200"
            />
            <button
              type="button"
              onClick={onCopyLink}
              aria-label={linkCopied ? t.copied : t.copy}
              className="px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
            >
              {linkCopied ? (
                <>
                  <Check className="h-5 w-5" aria-hidden="true" />
                  <span>{t.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" aria-hidden="true" />
                  <span>{t.copy}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
