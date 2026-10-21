import { memo } from 'react';
import { Select } from './ui';

interface Option {
  value: string;
  label: string;
}

interface SelectComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** Search field in the list. Defaults to on for lists longer than 6 options. */
  searchable?: boolean;
  disabled?: boolean;
}

/** Legacy API kept for existing screens; renders the shared combobox from components/ui. */
const SelectCombobox = ({ value, onValueChange, options = [], placeholder, searchable, disabled = false }: SelectComboboxProps) => (
  <Select
    value={value}
    onChange={onValueChange}
    options={options}
    placeholder={placeholder}
    searchable={searchable}
    disabled={disabled}
    className="h-10"
  />
);

export default memo(SelectCombobox);
