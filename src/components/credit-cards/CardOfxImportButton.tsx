import { useState, useSyncExternalStore } from 'react';
import { ReceiptText } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { getCardOfxMissing, subscribeCardOfxMissing } from '../../utils/cardOfx';
import { PageButton } from '../PageButton';
import ImportCardOfxDialog from '../ImportCardOfxDialog';

/**
 * Opens the invoice (.ofx) preview of a card. Hidden once the server has answered that it has no such importer
 * (the dialog notices the first 404), so a backend without the feature does not keep offering a button that cannot work.
 */
const CardOfxImportButton = ({ account }: { account: { id: string; name: string } }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const missing = useSyncExternalStore(subscribeCardOfxMissing, getCardOfxMissing);

  if (missing) return null;
  return (
    <>
      <PageButton onClick={() => setOpen(true)} variant="secondary" icon={ReceiptText} aria-label={t.cardOfxButtonLabel}>
        {t.cardOfxButton}
      </PageButton>
      {open && <ImportCardOfxDialog open onClose={() => setOpen(false)} account={account} />}
    </>
  );
};

export default CardOfxImportButton;
