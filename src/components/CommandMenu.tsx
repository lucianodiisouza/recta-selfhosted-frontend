import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Target, 
  CreditCard, 
  Wallet,
  FileText,
  BarChart3,
  Calendar,
  Sparkles,
  Sun,
  Moon,
  RefreshCcw,
  Download,
  Trophy
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { useDemoBlur } from '../context/DemoBlurContext';
import { Eye, EyeOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToastContext } from '../context/ToastContext';
import { analyticsHelpers } from '../utils/analytics';

interface CommandMenuProps {
  onNewTransaction: () => void;
  onNewRecurring: () => void;
  onNewBudget: () => void;
  onNewAccount: () => void;
  onNewGoal: () => void;
  onRestartOnboarding?: () => void;
  onShowConfetti?: () => void;
  onShowMonthlyRecap?: () => void;
  disabled?: boolean;
}

const CommandMenu = ({
  onNewTransaction,
  onNewRecurring,
  onNewBudget,
  onNewAccount,
  onNewGoal,
  onRestartOnboarding,
  onShowConfetti,
  onShowMonthlyRecap,
  disabled = false,
}: CommandMenuProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { isBlurred, toggleBlur } = useDemoBlur();
  const { install, isInstalled, canInstall } = usePWAInstall();
  const { success, error: showError } = useToastContext();

  // Close it when it gets disabled (onboarding, app lock).
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Toggle the menu when Cmd+K (Mac) or Ctrl+K (Windows/Linux) is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (disabled) return;
      
      // Cmd+K (Mac) ou Ctrl+K (Windows/Linux)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => {
          const newOpen = !open;
          if (newOpen) {
            analyticsHelpers.logCommandMenuOpened();
          }
          return newOpen;
        });
      }
      // ESC para fechar
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, disabled]);

  const runCommand = (command: () => void, commandName?: string) => {
    setOpen(false);
    if (commandName) {
      analyticsHelpers.logCommandMenuCommandExecuted(commandName);
    }
    command();
  };

  const handleNewTransaction = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/transactions') {
      // Navega para a página de transações
      navigate('/app/transactions');
      // Aguarda a navegação e então chama o handler
      setTimeout(() => {
        onNewTransaction();
      }, 200);
    } else {
      onNewTransaction();
    }
  };

  const handleNewRecurring = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/recurring') {
      navigate('/app/recurring');
      setTimeout(() => {
        onNewRecurring();
      }, 200);
    } else {
      onNewRecurring();
    }
  };

  const handleNewBudget = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/budgets') {
      navigate('/app/budgets');
      setTimeout(() => {
        onNewBudget();
      }, 200);
    } else {
      onNewBudget();
    }
  };

  const handleNewAccount = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/accounts') {
      navigate('/app/accounts');
      setTimeout(() => {
        onNewAccount();
      }, 200);
    } else {
      onNewAccount();
    }
  };

  const handleNewGoal = () => {
    const currentPath = window.location.pathname;
    if (currentPath !== '/goals') {
      navigate('/app/goals');
      setTimeout(() => {
        onNewGoal();
      }, 200);
    } else {
      onNewGoal();
    }
  };

  return (
    <>
      {/* Backdrop com blur */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99] transition-opacity"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <Command.Dialog 
        open={open} 
        onOpenChange={setOpen}
        className="fixed top-[50%] left-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] w-full max-w-lg"
        label={t.commandMenuPlaceholder}
      >
        <div className="overflow-hidden rounded-2xl bg-surface-elevated shadow-floating ring-1 ring-line-subtle animate-menu-in">
          <h2 className="sr-only">{t.commandMenuPlaceholder}</h2>
          <p className="sr-only">{t.commandMenuDescription}</p>
          <Command.Input 
            placeholder={t.commandMenuPlaceholder}
            className="w-full h-[52px] px-5 text-base border-0 border-b border-line-subtle focus:outline-none focus:ring-0 bg-transparent text-content placeholder:text-content-tertiary"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-content-tertiary">
            {t.commandMenuNoResults}
          </Command.Empty>

          <Command.Group heading={t.commandMenuTransactionsGroup} className="px-2 py-1.5 text-xs font-semibold text-content-tertiary">
            <Command.Item 
              onSelect={() => runCommand(handleNewTransaction)}
              className="flex items-center"
            >
              <Plus className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.newTransaction}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(handleNewRecurring)}
              className="flex items-center"
            >
              <Calendar className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.newRecurring}</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading={t.commandMenuManagementGroup} className="px-2 py-1.5 text-xs font-semibold text-content-tertiary">
            <Command.Item 
              onSelect={() => runCommand(handleNewBudget)}
              className="flex items-center"
            >
              <Target className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.newBudget}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(handleNewAccount)}
              className="flex items-center"
            >
              <Wallet className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.newAccount}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(handleNewGoal)}
              className="flex items-center"
            >
              <Target className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.commandMenuNewSavingsGoal}</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading={t.commandMenuNavigationGroup} className="px-2 py-1.5 text-xs font-semibold text-content-tertiary">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/'))}
              className="flex items-center"
            >
              <BarChart3 className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.dashboard}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/transactions'))}
              className="flex items-center"
            >
              <FileText className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.transactions}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/budgets'))}
              className="flex items-center"
            >
              <Target className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.budgets}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/recurring'))}
              className="flex items-center"
            >
              <Calendar className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.recurring}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/credit-cards'))}
              className="flex items-center"
            >
              <CreditCard className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.creditCards}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/accounts'))}
              className="flex items-center"
            >
              <Wallet className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.accounts}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/goals'))}
              className="flex items-center"
            >
              <Target className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.goals}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/reports'))}
              className="flex items-center"
            >
              <BarChart3 className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.reports}</span>
            </Command.Item>
            {onShowMonthlyRecap && (
              <Command.Item 
                onSelect={() => runCommand(onShowMonthlyRecap, 'showMonthlyRecap')}
                className="flex items-center"
              >
                <Trophy className="me-2 h-[18px] w-[18px] opacity-80" />
                <span>Monthly Recap</span>
              </Command.Item>
            )}
          </Command.Group>

          <Command.Group heading={t.commandMenuManagementGroup} className="px-2 py-1.5 text-xs font-semibold text-content-tertiary">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/app/settings'))}
              className="flex items-center"
            >
              <FileText className="me-2 h-[18px] w-[18px] opacity-80" />
              <span>{t.settings}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(toggleTheme)}
              className="flex items-center"
            >
              {theme === 'dark' ? (
                <Sun className="me-2 h-[18px] w-[18px] opacity-80" />
              ) : (
                <Moon className="me-2 h-[18px] w-[18px] opacity-80" />
              )}
              <span>{theme === 'dark' ? t.lightMode : t.darkMode}</span>
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(toggleBlur)}
              className="flex items-center"
            >
              {isBlurred ? (
                <EyeOff className="me-2 h-[18px] w-[18px] opacity-80" />
              ) : (
                <Eye className="me-2 h-[18px] w-[18px] opacity-80" />
              )}
              <span>{isBlurred ? t.showValuesBlur : t.hideValuesBlur}</span>
            </Command.Item>
            {onRestartOnboarding && (
              <Command.Item 
                onSelect={() => runCommand(onRestartOnboarding)}
                className="flex items-center"
              >
                <RefreshCcw className="me-2 h-[18px] w-[18px] opacity-80" />
                <span>{t.restartOnboarding}</span>
              </Command.Item>
            )}
            {!isInstalled && (
              <Command.Item 
                onSelect={async () => {
                  setOpen(false);
                  const installed = await install();
                  if (installed) {
                    success(t.installApp || 'App instalado com sucesso!');
                  } else if (!canInstall) {
                    showError(t.pwaInstallNotAvailable || 'Instalação não disponível no momento. Verifique as instruções nas configurações.');
                  }
                }}
                className="flex items-center"
              >
                <Download className="me-2 h-[18px] w-[18px] opacity-80" />
                <span>{t.installApp || 'Instalar App'}</span>
              </Command.Item>
            )}
          </Command.Group>

          {onShowConfetti && (
            <Command.Group heading={t.commandMenuFunGroup} className="px-2 py-1.5 text-xs font-semibold text-content-tertiary">
              <Command.Item 
                onSelect={() => runCommand(onShowConfetti)}
                className="flex items-center"
              >
                <Sparkles className="me-2 h-[18px] w-[18px] opacity-80" />
                <span>{t.commandMenuShowConfetti}</span>
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
      </div>
    </Command.Dialog>
    </>
  );
};

export default CommandMenu;

