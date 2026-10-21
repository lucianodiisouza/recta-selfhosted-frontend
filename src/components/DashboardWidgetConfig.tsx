import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';
import { WidgetConfig, WidgetId } from '../types';
import { Settings, Eye, EyeOff, RotateCcw, ChevronUp, ChevronDown, Save, GripVertical, Search, X, Grid3x3, List } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';
import * as Dialog from '@radix-ui/react-dialog';
import { DashboardWidgetsRenderer } from './dashboard/DashboardWidgetsRenderer';

const getWidgetLabels = (t: any): Record<WidgetId, string> => ({
  creditCards: t.creditCards,
  trends: t.trends,
  forecast: t.forecast,
  savingsGoals: t.savingsGoals,
  projectedBalance: t.projectedBalance,
  balanceEvolution: t.balanceEvolution,
  monthlyComparison: t.monthlyComparison,
  insights: t.insights,
  budgetVsRealized: t.budgetVsRealized,
  fixedVsVariable: t.fixedVsVariable,
  dailyCashFlow: t.dailyCashFlow,
  spendingHeatmap: t.spendingByDayOfMonth || 'Gastos por Dia do Mês',
});

const getWidgetDescriptions = (t: any): Record<WidgetId, string> => ({
  creditCards: t.creditCardsDescription || '',
  trends: t.trendsDescription || '',
  forecast: t.forecastDescription || '',
  savingsGoals: t.savingsGoalsDescription || '',
  projectedBalance: t.projectedBalanceDescription || '',
  balanceEvolution: t.balanceEvolutionDescription || '',
  monthlyComparison: t.monthlyComparisonDescription || '',
  insights: t.insightsDescription || '',
  budgetVsRealized: t.budgetVsRealizedDescription || '',
  fixedVsVariable: t.fixedVsVariableDescription || '',
  dailyCashFlow: t.dailyCashFlowDescription || '',
  spendingHeatmap: t.spendingByDayOfMonthDescription || 'Visualize seus gastos diários em um heatmap estilo GitHub',
});

// Error Boundary para capturar erros nos previews
class WidgetPreviewErrorBoundary extends Component<
  { children: ReactNode; widgetId: WidgetId; t: any },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; widgetId: WidgetId; t: any }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Widget preview error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const widgetLabel = getWidgetLabels(this.props.t)[this.props.widgetId];
      return (
        <div className="flex items-center justify-center h-32 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-line">
          <div className="text-center p-4">
            <div className="text-xs font-medium text-content-secondary mb-1">
              {widgetLabel}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-500">
              Preview não disponível
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Dados mockados para os previews
const getMockData = (_widgetId: WidgetId) => {
  const baseMock = {
    accountBalances: [
      { id: '1', name: 'Conta Principal', balance: 5000, availableBalance: 4500 },
      { id: '2', name: 'Poupança', balance: 10000, availableBalance: 10000 },
    ],
    totalProjectedBalance: 15000,
    totalAvailableBalance: 14500,
    totalIncome: 7000,
    totalExpense: 2800,
    trend: {
      income: { current: 7000, previous: 6500, change: 7.7 },
      expense: { current: 2800, previous: 3000, change: -6.7 },
      balance: { current: 14500, previous: 12000, change: 20.8 },
    },
    forecast: {
      projectedIncome: 7000,
      projectedExpense: 3000,
      projectedBalance: 14000,
    },
    balanceEvolution: [
      { month: 'Jan', balance: 10000 },
      { month: 'Fev', balance: 12000 },
      { month: 'Mar', balance: 14500 },
    ],
    monthlyComparison: {
      current: { income: 7000, expense: 2800 },
      previous: { income: 6500, expense: 3000 },
    },
    incomeChange: 7.7,
    expenseChange: -6.7,
    balanceChange: 20.8,
    categoryData: [
      { name: 'Alimentação', value: 1500 },
      { name: 'Transporte', value: 800 },
    ],
  };

  return baseMock;
};

// Componente de preview seguro para widgets
const WidgetPreview = ({ widgetId, t }: { widgetId: WidgetId; t: any }) => {
  const mockData = getMockData(widgetId);
  
  return (
    <WidgetPreviewErrorBoundary widgetId={widgetId} t={t}>
      <div className="w-full">
        <DashboardWidgetsRenderer
          widgetId={widgetId}
          loading={false}
          preferencesLoading={false}
          isBlurred={false}
          selectedMonth={new Date()}
          accountBalances={mockData.accountBalances}
          totalProjectedBalance={mockData.totalProjectedBalance}
          totalAvailableBalance={mockData.totalAvailableBalance}
          totalIncome={mockData.totalIncome}
          totalExpense={mockData.totalExpense}
          trend={mockData.trend}
          forecast={mockData.forecast}
          balanceEvolution={mockData.balanceEvolution}
          monthlyComparison={mockData.monthlyComparison}
          incomeChange={mockData.incomeChange}
          expenseChange={mockData.expenseChange}
          balanceChange={mockData.balanceChange}
          categoryData={mockData.categoryData}
          t={t}
        />
      </div>
    </WidgetPreviewErrorBoundary>
  );
};

interface DashboardWidgetConfigProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DashboardWidgetConfig = ({ isOpen, onClose }: DashboardWidgetConfigProps) => {
  const { preferences, savePreferences, resetToDefault, loading } = useDashboardPreferences();
  const { t } = useI18n();
  const [localWidgets, setLocalWidgets] = useState<WidgetConfig[]>(preferences.widgets);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredWidget, setHoveredWidget] = useState<WidgetId | null>(null);
  
  // Detectar tamanho da tela para mostrar previews
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const canShowPreviews = screenWidth >= 1024; // lg breakpoint

  // Atualizar widgets locais quando preferências mudarem
  useEffect(() => {
    setLocalWidgets(preferences.widgets);
    setHasChanges(false);
  }, [preferences.widgets]);

  // Filtrar widgets por busca
  const filteredWidgets = localWidgets.filter(widget => {
    if (!searchTerm) return true;
    const label = getWidgetLabels(t)[widget.id].toLowerCase();
    const description = getWidgetDescriptions(t)[widget.id]?.toLowerCase() || '';
    return label.includes(searchTerm.toLowerCase()) || description.includes(searchTerm.toLowerCase());
  });

  const moveUp = (index: number) => {
    if (index === 0) return;
    
    const widgetId = filteredWidgets[index].id;
    const actualIndex = localWidgets.findIndex(w => w.id === widgetId);
    if (actualIndex === 0) return;
    
    const newWidgets = [...localWidgets];
    const temp = newWidgets[actualIndex];
    newWidgets[actualIndex] = newWidgets[actualIndex - 1];
    newWidgets[actualIndex - 1] = temp;
    
    setLocalWidgets(newWidgets);
    setHasChanges(true);
  };

  const moveDown = (index: number) => {
    if (index === filteredWidgets.length - 1) return;
    
    const widgetId = filteredWidgets[index].id;
    const actualIndex = localWidgets.findIndex(w => w.id === widgetId);
    if (actualIndex === localWidgets.length - 1) return;
    
    const newWidgets = [...localWidgets];
    const temp = newWidgets[actualIndex];
    newWidgets[actualIndex] = newWidgets[actualIndex + 1];
    newWidgets[actualIndex + 1] = temp;
    
    setLocalWidgets(newWidgets);
    setHasChanges(true);
  };

  const moveToTop = (index: number) => {
    const widgetId = filteredWidgets[index].id;
    const actualIndex = localWidgets.findIndex(w => w.id === widgetId);
    if (actualIndex === 0) return;
    
    const newWidgets = [...localWidgets];
    const widget = newWidgets.splice(actualIndex, 1)[0];
    newWidgets.unshift(widget);
    
    setLocalWidgets(newWidgets);
    setHasChanges(true);
  };

  const moveToBottom = (index: number) => {
    const widgetId = filteredWidgets[index].id;
    const actualIndex = localWidgets.findIndex(w => w.id === widgetId);
    if (actualIndex === localWidgets.length - 1) return;
    
    const newWidgets = [...localWidgets];
    const widget = newWidgets.splice(actualIndex, 1)[0];
    newWidgets.push(widget);
    
    setLocalWidgets(newWidgets);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const reorderedWidgets = localWidgets.map((widget, index) => ({
      ...widget,
      order: index,
    }));
    
    try {
      const orderChanged = reorderedWidgets.some((widget, index) => {
        const originalWidget = preferences.widgets.find(w => w.id === widget.id);
        return originalWidget?.order !== index;
      });
      
      const visibilityChanges = reorderedWidgets.filter(widget => {
        const originalWidget = preferences.widgets.find(w => w.id === widget.id);
        return originalWidget?.enabled !== widget.enabled;
      });
      
      const newPreferences = {
        widgets: reorderedWidgets,
      };
      await savePreferences(newPreferences);
      
      if (orderChanged) {
        analyticsHelpers.logDashboardWidgetReordered(reorderedWidgets.length);
      }
      visibilityChanges.forEach(widget => {
        analyticsHelpers.logDashboardWidgetToggled(widget.id, widget.enabled);
      });
      
      setHasChanges(false);
      onClose();
    } catch (error) {
      setLocalWidgets(preferences.widgets);
      setHasChanges(false);
    }
  };

  const handleToggle = (widgetId: WidgetId) => {
    setLocalWidgets(prevWidgets =>
      prevWidgets.map(widget =>
        widget.id === widgetId
          ? { ...widget, enabled: !widget.enabled }
          : widget
      )
    );
    setHasChanges(true);
  };

  const handleReset = async () => {
    if (window.confirm(t.resetToDefaultConfirm)) {
      await resetToDefault();
      analyticsHelpers.logDashboardWidgetsReset();
      setHasChanges(false);
    }
  };

  const enabledCount = localWidgets.filter(w => w.enabled).length;
  const totalCount = localWidgets.length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop z-50" />
        <Dialog.Content className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-surface-elevated rounded-lg shadow-xl w-full ${
          viewMode === 'grid' && canShowPreviews ? 'max-w-7xl' : 'max-w-3xl'
        } max-h-[90vh] overflow-hidden z-50 flex flex-col`}>
          {/* Header */}
          <div className="sticky top-0 bg-surface-elevated border-b border-line px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-content-secondary" />
              <div>
                <Dialog.Title className="text-lg font-semibold text-content">
                  {t.widgetConfigTitle}
                </Dialog.Title>
                <p className="text-xs text-content-tertiary mt-0.5">
                  {t.widgetConfigSubtitle?.replace('{enabled}', enabledCount.toString()).replace('{total}', totalCount.toString()) || `${enabledCount} de ${totalCount} widgets ativos`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  {t.save}
                </button>
              )}
              <Dialog.Close asChild>
                <button
                  className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 hover:bg-surface-sunken rounded-md transition-colors"
                  aria-label={t.close}
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Search and View Controls */}
          <div className="px-6 py-4 border-b border-line flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t.searchWidgets || 'Buscar widgets...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-line rounded-md bg-surface-elevated text-content placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {canShowPreviews && (
              <div className="flex items-center gap-2 border border-line rounded-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-brand-soft text-brand-on-soft'
                      : 'text-content-secondary hover:bg-surface-sunken'
                  }`}
                  title="Visualização em grade"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-brand-soft text-brand-on-soft'
                      : 'text-content-secondary hover:bg-surface-sunken'
                  }`}
                  title="Visualização em lista"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Widgets List/Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center text-content-tertiary py-8">
                {t.loading}
              </div>
            ) : filteredWidgets.length === 0 ? (
              <div className="text-center text-content-tertiary py-8">
                {t.noWidgetsFound || 'Nenhum widget encontrado'}
              </div>
            ) : viewMode === 'grid' && canShowPreviews ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWidgets.map((widget, index) => {
                  const description = getWidgetDescriptions(t)[widget.id];
                  const _isHovered = hoveredWidget === widget.id;
                  return (
                    <div
                      key={widget.id}
                      onMouseEnter={() => setHoveredWidget(widget.id)}
                      onMouseLeave={() => setHoveredWidget(null)}
                      className={`relative group border rounded-lg transition-all overflow-hidden ${
                        widget.enabled
                          ? 'border-line bg-surface-elevated hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-lg'
                          : 'border-line bg-gray-50 dark:bg-gray-800/50 opacity-60'
                      }`}
                    >
                      {/* Preview do Widget */}
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-line h-[450px] overflow-hidden relative">
                        <div className="absolute inset-0 p-4">
                          <div className="w-full h-full" style={{ transform: 'scale(0.55)', transformOrigin: 'top left' }}>
                            <div style={{ width: '182%', height: '182%' }}>
                              <WidgetPreview widgetId={widget.id} t={t} />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Widget Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`font-semibold text-sm ${
                                widget.enabled
                                  ? 'text-content'
                                  : 'text-content-tertiary'
                              }`}>
                                {getWidgetLabels(t)[widget.id]}
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken text-content-secondary">
                                #{index + 1}
                              </span>
                            </div>
                            {description && (
                              <p className="text-xs text-content-tertiary line-clamp-2">
                                {description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => moveUp(index)}
                              disabled={index === 0}
                              className={`p-1.5 rounded transition-colors ${
                                index === 0
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : 'text-content-secondary hover:bg-surface-sunken'
                              }`}
                              title={t.moveUp}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={index === filteredWidgets.length - 1}
                              className={`p-1.5 rounded transition-colors ${
                                index === filteredWidgets.length - 1
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : 'text-content-secondary hover:bg-surface-sunken'
                              }`}
                              title={t.moveDown}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => handleToggle(widget.id)}
                            className={`p-2 rounded-md transition-colors ${
                              widget.enabled
                                ? 'text-positive hover:bg-green-50 dark:hover:bg-green-900/30'
                                : 'text-content-tertiary hover:bg-surface-sunken'
                            }`}
                            title={widget.enabled ? t.hideWidget : t.showWidget}
                          >
                            {widget.enabled ? (
                              <Eye className="h-5 w-5" />
                            ) : (
                              <EyeOff className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWidgets.map((widget, index) => {
                  const description = getWidgetDescriptions(t)[widget.id];
                  return (
                    <div
                      key={widget.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg transition-all ${
                        widget.enabled
                          ? 'border-line bg-surface-elevated hover:border-gray-300 dark:hover:border-gray-600'
                          : 'border-line bg-gray-50 dark:bg-gray-800/50 opacity-60'
                      }`}
                    >
                      {/* Drag Handle */}
                      <div className="flex flex-col gap-1 text-content-tertiary">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Move Controls */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className={`p-1 rounded transition-colors ${
                            index === 0
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
                          }`}
                          title={t.moveUp}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index === filteredWidgets.length - 1}
                          className={`p-1 rounded transition-colors ${
                            index === filteredWidgets.length - 1
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
                          }`}
                          title={t.moveDown}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Widget Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${
                            widget.enabled
                              ? 'text-content'
                              : 'text-content-tertiary'
                          }`}>
                            {getWidgetLabels(t)[widget.id]}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken text-content-secondary">
                            #{index + 1}
                          </span>
                        </div>
                        {description && (
                          <p className="text-xs text-content-tertiary line-clamp-2">
                            {description}
                          </p>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2">
                        {index > 0 && (
                          <button
                            onClick={() => moveToTop(index)}
                            className="p-1.5 text-gray-400 hover:text-content-secondary hover:bg-surface-sunken rounded transition-colors"
                            title={t.moveToTop || 'Mover para o topo'}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        )}
                        {index < filteredWidgets.length - 1 && (
                          <button
                            onClick={() => moveToBottom(index)}
                            className="p-1.5 text-gray-400 hover:text-content-secondary hover:bg-surface-sunken rounded transition-colors"
                            title={t.moveToBottom || 'Mover para o final'}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggle(widget.id)}
                          className={`p-2 rounded-md transition-colors ${
                            widget.enabled
                              ? 'text-positive hover:bg-green-50 dark:hover:bg-green-900/30'
                              : 'text-content-tertiary hover:bg-surface-sunken'
                          }`}
                          title={widget.enabled ? t.hideWidget : t.showWidget}
                        >
                          {widget.enabled ? (
                            <Eye className="h-5 w-5" />
                          ) : (
                            <EyeOff className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-surface-elevated border-t border-line px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-content-secondary bg-surface-elevated border border-line rounded-md hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              title={t.resetToDefault}
            >
              <RotateCcw className="h-4 w-4" />
              {t.resetToDefault}
            </button>
            <div className="flex items-center gap-3">
              <Dialog.Close asChild>
                <button
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
                >
                  {t.cancel}
                </button>
              </Dialog.Close>
              {hasChanges && (
                <button
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
                >
                  {t.save}
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
