import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { normalizeJoinCode } from '../../utils/pendingJoin';
import { Button, Input } from '../ui';

/** "Got a code?": goes to /join/<code>, which shows the household before joining. */
export const JoinWithCodeForm = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const code = normalizeJoinCode(value);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 8) return;
    onNavigate?.();
    navigate(`/join/${code}`);
  };

  return (
    <form onSubmit={submit} className="mt-6 pt-6 border-t border-line-subtle">
      <h4 className="text-sm font-medium text-content-secondary mb-1">{t.joinWithCodeTitle}</h4>
      <p className="text-xs text-content-tertiary mb-3">{t.joinWithCodeHint}</p>
      <div className="flex gap-2">
        <Input
          icon={KeyRound}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ABCD-2345"
          aria-label={t.joinWithCodeTitle}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase tracking-wider"
        />
        <Button type="submit" variant="secondary" disabled={code.length !== 8}>{t.joinWithCodeAction}</Button>
      </div>
    </form>
  );
};
