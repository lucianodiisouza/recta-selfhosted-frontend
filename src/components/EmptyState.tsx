import { LucideIcon } from 'lucide-react';
import { EmptyState as UiEmptyState } from './ui';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** Legacy API kept for existing screens; renders the shared empty state from components/ui. */
export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <UiEmptyState icon={icon} title={title} description={description} action={action} />
);
