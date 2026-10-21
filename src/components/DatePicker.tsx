import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR, enUS, es, fr, ru, ja, zhCN, arSA, Locale } from 'date-fns/locale';
import { Calendar } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { parseDateFromAPI } from '../utils/format';
import {
  CalendarHeader,
  CalendarWeekDays,
  CalendarGrid,
  CalendarFooter,
  DatePickerModal,
} from './date-picker';

const localeMap: Record<string, Locale> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': es,
  'fr-FR': fr,
  'ru-RU': ru,
  'ja-JP': ja,
  'zh-CN': zhCN,
  'ar-SA': arSA,
};

interface DatePickerProps {
  value: Date | null | undefined;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  showTime?: boolean;
  dateFormat?: string;
  useModal?: boolean; // Quando true, abre o datepicker em um modal sobreposto
}

export const DatePicker = ({
  value,
  onChange,
  placeholder = 'Selecionar data',
  minDate,
  maxDate,
  disabled = false,
  className = '',
  showTime = false,
  dateFormat = 'dd/MM/yyyy',
  useModal = false,
}: DatePickerProps) => {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? startOfMonth(value) : startOfMonth(new Date()));
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLocale = localeMap[locale] || ptBR;

  // Parse value to Date, handling timezone issues
  // Normalize to local midnight to avoid timezone shifts
  // Use useMemo to prevent infinite loops - memoize based on timestamp string
  const valueTimestamp = value instanceof Date ? value.getTime() : value;
  const selectedDate = useMemo(() => {
    // Prioriza tempSelectedDate se existir (para feedback visual imediato)
    // Isso funciona tanto no modo modal quanto no modo dropdown
    if (tempSelectedDate !== null) {
      return tempSelectedDate;
    }
    // Caso contrário, usa o value
    if (!value) return null;
    const date = value instanceof Date ? value : parseDateFromAPI(value as any);
    // Extract local components first to avoid any timezone conversion
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    // Create new date at noon first (avoids DST issues), then set to midnight
    const normalized = new Date(year, month, day, 12, 0, 0, 0);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueTimestamp, tempSelectedDate]);

  // Handlers
  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setTempSelectedDate(null);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    // Extract local date components to avoid any timezone conversion
    // getFullYear, getMonth, getDate always return LOCAL values
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create new date in local timezone at noon to avoid DST issues
    // Using noon instead of midnight helps avoid edge cases with daylight saving time
    const selectedDate = new Date(year, month, day, 12, 0, 0, 0);
    // Then set to midnight to ensure consistency
    selectedDate.setHours(0, 0, 0, 0);
    
    // Sempre atualiza tempSelectedDate para feedback visual imediato
    setTempSelectedDate(selectedDate);
    
    if (useModal) {
      // No modo modal, apenas atualiza a data temporária (não chama onChange ainda)
      // O usuário precisa confirmar
    } else {
      // Fora do modo modal, aplica a mudança imediatamente e fecha
      onChange(selectedDate);
      if (!showTime) {
        setIsOpen(false);
      }
    }
  }, [useModal, showTime, onChange]);

  const handleConfirm = useCallback(() => {
    // Sempre confirma com a data temporária (que é a selecionada no modal)
    // Se tempSelectedDate for null, significa que não foi selecionada nenhuma data
    if (tempSelectedDate !== null) {
      onChange(tempSelectedDate);
    } else {
      // Se tempSelectedDate é null, passa null para limpar o valor
      onChange(null);
    }
    setIsOpen(false);
    // Não limpa tempSelectedDate aqui - será limpo quando o modal fechar e o value atualizar
  }, [tempSelectedDate, onChange]);

  // Close on outside click (apenas se não estiver em modo modal)
  useEffect(() => {
    if (useModal) return; // Não fecha com click fora no modo modal
    
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, useModal]);

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (!isOpen || !useModal) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, useModal, handleCancel]);

  // Reset to selected date's month when opening (separate effect to avoid loop)
  // Use value directly instead of selectedDate to avoid dependency issues
  const valueTimestampForEffect = value instanceof Date ? value.getTime() : value;
  useEffect(() => {
    if (isOpen) {
      // Inicializa a data temporária com o valor atual (tanto no modo modal quanto no dropdown)
      if (value) {
        const date = value instanceof Date ? value : parseDateFromAPI(value as any);
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const normalized = new Date(year, month, day, 12, 0, 0, 0);
        normalized.setHours(0, 0, 0, 0);
        setTempSelectedDate(normalized);
        setCurrentMonth(startOfMonth(date));
      } else {
        // Se não há valor, inicializa com null
        setTempSelectedDate(null);
      }
    }
    // Não limpa tempSelectedDate quando fecha - deixa o outro useEffect cuidar disso
    // quando o value for atualizado
  }, [isOpen, valueTimestampForEffect, useModal, value]);

  // Limpa tempSelectedDate quando o value atualizar e corresponder ao que foi selecionado
  // Mas mantém enquanto o dropdown estiver aberto para feedback visual
  useEffect(() => {
    // Se o dropdown está aberto, mantém tempSelectedDate para feedback visual
    if (isOpen) {
      return;
    }
    
    if (tempSelectedDate !== null) {
      if (value) {
        const date = value instanceof Date ? value : parseDateFromAPI(value as any);
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const normalized = new Date(year, month, day, 12, 0, 0, 0);
        normalized.setHours(0, 0, 0, 0);
        
        // Compara ano, mês e dia
        const tempYear = tempSelectedDate.getFullYear();
        const tempMonth = tempSelectedDate.getMonth();
        const tempDay = tempSelectedDate.getDate();
        
        // Se as datas correspondem (comparando apenas ano, mês e dia), limpa a temporária
        if (normalized.getFullYear() === tempYear && 
            normalized.getMonth() === tempMonth && 
            normalized.getDate() === tempDay) {
          // Usa um pequeno delay para garantir que o componente pai tenha atualizado
          const timeoutId = setTimeout(() => {
            setTempSelectedDate(null);
          }, 100);
          return () => clearTimeout(timeoutId);
        }
      } else if (!value && !useModal) {
        // No modo não-modal, se value é null, limpa a temporária
        setTempSelectedDate(null);
      }
    }
  }, [value, tempSelectedDate, useModal, isOpen]);


  const handleToday = useCallback(() => {
    // Get today's date in local timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    handleDateSelect(today);
    // No modo modal, não fecha automaticamente
    if (!useModal) {
      setIsOpen(false);
    }
  }, [handleDateSelect, useModal]);

  const handleClear = () => {
    if (useModal) {
      setTempSelectedDate(null);
    } else {
      onChange(null);
      setIsOpen(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(startOfMonth(new Date()));
  };

  // Get calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0, locale: currentLocale });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0, locale: currentLocale });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const displayValue = selectedDate ? format(selectedDate, dateFormat, { locale: currentLocale }) : '';

  // Componente do calendário (reutilizado no dropdown e no modal)
  const renderCalendar = () => (
    <>
      <CalendarHeader
        currentMonth={currentMonth}
        currentLocale={currentLocale}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onGoToToday={goToToday}
      />

      <CalendarWeekDays
        calendarStart={calendarStart}
        currentLocale={currentLocale}
      />

      <CalendarGrid
        days={days}
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        minDate={minDate}
        maxDate={maxDate}
        currentLocale={currentLocale}
        onDateSelect={handleDateSelect}
      />

      <CalendarFooter
        selectedDate={selectedDate}
        onToday={handleToday}
        onClear={handleClear}
      />
    </>
  );

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 h-10 w-full border rounded-lg bg-surface-elevated text-content focus:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 text-sm font-medium transition-colors ${
            disabled
              ? '!bg-surface-sunken text-content-tertiary cursor-not-allowed border-line'
              : 'border-line hover:bg-surface-sunken'
          } ${isOpen ? '!border-brand' : ''} ${!displayValue && !disabled ? 'text-content-tertiary' : ''}`}
        >
          <Calendar className="h-4 w-4 text-content-tertiary flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-start text-sm truncate">{displayValue || placeholder}</span>
        </button>

        {/* Dropdown mode (não-modal) */}
        {isOpen && !disabled && !useModal && (
          <div className="absolute z-50 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-surface-elevated rounded-xl shadow-floating ring-1 ring-line-subtle p-3 sm:p-4 animate-menu-in">
            {renderCalendar()}
          </div>
        )}
      </div>

      {/* Modal mode */}
      {isOpen && !disabled && useModal && (
        <DatePickerModal
          placeholder={placeholder}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        >
          {renderCalendar()}
        </DatePickerModal>
      )}
    </>
  );
};

