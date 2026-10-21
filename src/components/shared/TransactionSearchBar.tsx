import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface TransactionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  disabled?: boolean;
}

export const TransactionSearchBar = ({
  value,
  onChange,
  placeholder = 'Buscar transações...',
  className = '',
  debounceMs = 300,
  disabled = false,
}: TransactionSearchBarProps) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(inputValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, onChange, debounceMs]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleClear = () => {
    setInputValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`block w-full pl-10 pr-10 py-2 border border-line rounded-lg bg-surface-elevated text-content placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
          disabled ? 'bg-gray-100 dark:bg-gray-900/50 text-content-tertiary cursor-not-allowed' : ''
        }`}
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label="Limpar busca"
        >
          <X className="h-5 w-5 text-gray-400 hover:text-content-secondary" />
        </button>
      )}
    </div>
  );
};
