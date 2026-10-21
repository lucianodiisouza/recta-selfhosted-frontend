import { ReactNode, Children, useState, isValidElement } from 'react';
import { MoreVertical } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useI18n } from '../context/I18nContext';

interface PageHeaderProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  children?: ReactNode;
}

export const PageHeader = ({ title, description, children }: PageHeaderProps) => {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Contar elementos filhos válidos
  const childrenArray = Children.toArray(children).filter(isValidElement);
  const childrenCount = childrenArray.length;
  
  // No mobile: 
  // - Se tiver 2 ou menos: mostrar todos
  // - Se tiver 3: mostrar os 2 primeiros e o último sempre visível (para menus de ação)
  // - Se tiver mais de 3: mostrar os 2 primeiros, o último sempre visível, resto no dropdown
  let mobileVisible: React.ReactElement[] = [];
  let mobileAlwaysVisible: React.ReactElement[] = [];
  let mobileHidden: React.ReactElement[] = [];
  
  if (childrenCount <= 2) {
    mobileVisible = childrenArray;
  } else if (childrenCount === 3) {
    // Mostrar os 2 primeiros e o último sempre visível
    mobileVisible = childrenArray.slice(0, 2);
    mobileAlwaysVisible = childrenArray.slice(2);
  } else {
    // Mais de 3: 2 primeiros visíveis, último sempre visível, resto no dropdown
    mobileVisible = childrenArray.slice(0, 2);
    mobileAlwaysVisible = childrenArray.slice(-1);
    mobileHidden = childrenArray.slice(2, -1);
  }

  return (
    <div className="mb-5 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-4">
      <div className="min-w-0 flex-shrink">
        <h1 className="font-rounded text-[28px] sm:text-[34px] leading-tight font-bold tracking-tight text-content">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[15px] text-content-secondary">
            {description}
          </p>
        )}
      </div>
      {children && (
        <>
          {/* Mobile: botões full width ou dividem espaço */}
          <div className="flex gap-2 items-stretch w-full sm:hidden flex-shrink-0">
            {mobileVisible.map((child, index) => (
              <div key={index} className="flex-1 min-w-0 flex">
                {child}
              </div>
            ))}
            {mobileAlwaysVisible.map((child, index) => (
              <div key={`always-${index}`} className="flex-shrink-0 flex items-stretch">
                {child}
              </div>
            ))}
            {mobileHidden.length > 0 && (
              <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
                <Popover.Trigger asChild>
                  <button
                    className="inline-flex items-center justify-center px-3 rounded-lg border border-line bg-surface-elevated text-content-secondary hover:bg-surface-sunken transition-colors flex-shrink-0 self-stretch"
                    aria-label={t.moreOptions}
                  >
                    <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="w-56 bg-surface-elevated rounded-xl shadow-floating ring-1 ring-line-subtle z-[100] p-1"
                    sideOffset={4}
                    align="end"
                  >
                    <div className="py-1 space-y-1">
                      {mobileHidden.map((child, index) => {
                        // Clonar o elemento e adicionar classes para estilo de menu
                        if (isValidElement(child)) {
                          return (
                            <div
                              key={index}
                              className="w-full [&>button]:w-full [&>button]:justify-start [&>button]:rounded-sm [&>button]:shadow-none [&>button]:h-auto [&>button]:px-4 [&>button]:py-2"
                              onClick={() => setMenuOpen(false)}
                            >
                              {child}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
          </div>
          
          {/* Desktop: todos os botões */}
          <div className="hidden sm:flex gap-2 items-center w-auto flex-shrink-0">
            {children}
          </div>
        </>
      )}
    </div>
  );
};

