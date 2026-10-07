import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { autoFillClosingDay, closingDayFromDue } from '../utils/closingDay';

/**
 * Keeps the closing-day field at due day - 7 while the user has not typed their own value. Returns the current
 * suggestion (for the placeholder and the hint). `enabled` false turns the effect off (e.g. editing without a due day field).
 */
export function useClosingDayAutoFill<T extends FieldValues>(form: UseFormReturn<T>, enabled = true): number | null {
  const { watch, getValues, setValue } = form;
  const dueDay = watch('dueDay' as never) as unknown as number | undefined;
  const lastSuggested = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const closing = getValues('closingDay' as never) as unknown as number | undefined;
    const result = autoFillClosingDay({ dueDay, closingDay: closing, lastSuggested: lastSuggested.current });
    lastSuggested.current = result.suggested;
    const normalizedCurrent = typeof closing === 'number' && !Number.isNaN(closing) ? closing : undefined;
    if (result.closingDay !== normalizedCurrent) {
      setValue('closingDay' as never, result.closingDay as never, { shouldDirty: true, shouldValidate: false });
    }
  }, [dueDay, enabled, getValues, setValue]);

  return closingDayFromDue(typeof dueDay === 'number' ? dueDay : null);
}
