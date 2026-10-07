import { useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useCreatePerson, usePeople, useUpdatePerson } from '../../hooks/api/usePeople';
import type { Person } from '../../hooks/api/usePeople';
import { useToastContext } from '../../context/ToastContext';
import { useI18n } from '../../context/I18nContext';
import { MAX_PERSON_NAME, cleanAliases, parseAliasText, personSaveFailure, validatePersonForm } from '../../utils/people';
import { personFormErrorText } from './peopleText';
import { BTN_PRIMARY, BTN_SECONDARY, CHECKBOX_CLS, DialogShell, ERROR_CLS, INPUT_CLS, LABEL_CLS, MUTED_CLS } from './ui';

interface PersonFormDialogProps {
  open: boolean;
  onClose: () => void;
  householdId: string | undefined;
  /** The person being edited; null creates one. */
  person: Person | null;
  /** Called with the saved person (the page selects a new one). */
  onSaved?: (person: Person) => void;
  /** Stacking level when opened from another dialog. */
  zClass?: string;
}

/** Add or edit a person: name, nicknames (comma separated) and, when editing, whether the person is active. */
const PersonFormDialog = ({ open, onClose, householdId, person, onSaved, zClass }: PersonFormDialogProps) => {
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { data: allPeople } = usePeople(householdId, true);
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson();
  const [name, setName] = useState('');
  const [aliasText, setAliasText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The form is seeded when it opens (or when another person is edited): a refetch of the same person must not wipe
  // what the user is typing.
  const personRef = useRef(person);
  personRef.current = person;
  useEffect(() => {
    if (!open) return;
    const current = personRef.current;
    setName(current?.name ?? '');
    setAliasText(current ? current.aliases.join(', ') : '');
    setIsActive(current?.isActive ?? true);
    setFormError(null);
  }, [open, person?.id]);

  const aliases = useMemo(() => cleanAliases(name, parseAliasText(aliasText)), [name, aliasText]);
  const check = useMemo(() => validatePersonForm(name, aliases, allPeople ?? [], person?.id ?? null), [name, aliases, allPeople, person]);
  const liveError = !check.ok && check.error ? personFormErrorText(t, check.error) : null;

  const handleSave = async () => {
    if (!check.ok) return;
    if (!householdId) {
      setFormError(t.peopleErrNoHousehold);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = person
        ? await updateMutation.mutateAsync({ id: person.id, name: name.trim(), aliases, isActive })
        : await createMutation.mutateAsync({ householdId, name: name.trim(), aliases });
      success(person ? t.peopleUpdated : t.peopleCreated);
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      const failure = personSaveFailure(err);
      const message = failure.code === 'conflict' ? t.peopleErrConflict : failure.code === 'message' ? failure.message : t.peopleErrSaveFailed;
      setFormError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogShell open={open} onClose={onClose} canClose={!saving} titleId="person-form-title" widthClass="max-w-lg" zClass={zClass}
      title={person ? t.peopleFormEditTitle : t.peopleNew} icon={<UserPlus className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />}>
      <div className="space-y-4 min-w-0">
        <div>
          <label htmlFor="person-name" className={LABEL_CLS}>{t.name}</label>
          <input id="person-name" type="text" value={name} maxLength={MAX_PERSON_NAME} disabled={saving} className={INPUT_CLS} autoFocus
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="person-aliases" className={LABEL_CLS}>{t.peopleFormAliases}</label>
          <input id="person-aliases" type="text" value={aliasText} disabled={saving} className={INPUT_CLS} placeholder={t.peopleFormAliasesPlaceholder}
            onChange={(e) => setAliasText(e.target.value)} />
          <p className={`mt-1 text-xs ${MUTED_CLS}`}>{t.peopleFormAliasesHint}</p>
        </div>
        {person && (
          <label htmlFor="person-active" className="inline-flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
            <input id="person-active" type="checkbox" checked={isActive} disabled={saving} className={CHECKBOX_CLS}
              onChange={(e) => setIsActive(e.target.checked)} />
            {t.peopleFormActive}
          </label>
        )}
        {(formError ?? liveError) && <p role="alert" className={ERROR_CLS}>{formError ?? liveError}</p>}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>{t.cancel}</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving || !check.ok} className={BTN_PRIMARY}>
            {saving ? t.peopleFormSaving : t.save}
          </button>
        </div>
      </div>
    </DialogShell>
  );
};

export default PersonFormDialog;
