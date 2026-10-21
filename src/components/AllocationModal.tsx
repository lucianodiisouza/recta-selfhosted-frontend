import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransactions } from "../context/TransactionsContext";
import { useCurrencyMask } from "../hooks/useCurrencyMask";
import { useToastContext } from "../context/ToastContext";
import { useI18n } from "../context/I18nContext";
import { useCurrency } from "../context/CurrencyContext";
import { formatCurrency } from "../utils/format";
import { X } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { parseCurrencyValue } from "../utils/currency";
import { formatDateForAPI } from "../utils/format";
import {
  useCreateAllocation,
  useCreateDeallocation,
} from "../hooks/api/useTransactions";
import { AccountType } from "../lib/enums";
import SelectCombobox from "./SelectCombobox";
import { getAccountBalance } from "../utils/accountBalance";
import { analyticsHelpers } from "../utils/analytics";

interface AllocationModalProps {
  accountId: string | null;
  creditCardId: string | null;
  isOpen: boolean;
  onClose: () => void;
  mode: "allocate" | "deallocate";
  onCreditCardSelect?: (creditCardId: string) => void;
}

const createAllocationSchema = (
  maxAmount?: number,
  t?: any,
  baseCurrency?: string
) => {
  const maxAmountFormatted =
    maxAmount && t && baseCurrency ? formatCurrency(maxAmount) : "";
  return z.object({
    amount: z
      .number()
      .positive(t?.amountMustBePositive || "O valor deve ser positivo")
      .max(
        maxAmount || Infinity,
        maxAmount && t && maxAmountFormatted
          ? `${t.amountMustBePositive}. ${t.maximumAvailable}: ${maxAmountFormatted}`
          : t?.amountMustBePositive || t?.error || "Valor inválido"
      ),
    description: z.string().max(255).optional(),
    date: z.date(),
    notes: z.string().max(1000).optional(),
  });
};

type AllocationFormData = z.infer<ReturnType<typeof createAllocationSchema>>;

export const AllocationModal = ({
  accountId,
  creditCardId,
  isOpen,
  onClose,
  mode,
  onCreditCardSelect,
}: AllocationModalProps) => {
  const { accounts } = useTransactions();

  const creditCards = accounts.filter((a) => a.type === AccountType.CREDIT);
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const currencyMask = useCurrencyMask();
  const createAllocation = useCreateAllocation();
  const createDeallocation = useCreateDeallocation();

  const account = accounts.find((a) => a.id === accountId);

  const [selectedCreditCardId, setSelectedCreditCardId] = useState<
    string | null
  >(creditCardId);

  useEffect(() => {
    if (isOpen) {
      setSelectedCreditCardId(creditCardId);
    }
  }, [isOpen, creditCardId]);

  const selectedCreditCard = accounts.find(
    (a) => a.id === selectedCreditCardId
  );

  // Get account balances - SINGLE SOURCE OF TRUTH
  const accountBalances = useMemo(() => {
    return getAccountBalance(account);
  }, [account]);

  const { totalBalance, availableBalance, allocatedBalance } = accountBalances;
  const creditCardLimit = selectedCreditCard
    ? selectedCreditCard.totalLimit || selectedCreditCard.creditLimit || 0
    : 0;

  // Determinar o valor máximo permitido baseado no modo e cartão selecionado
  const maxAmount = useMemo(() => {
    if (mode === "allocate") {
      return availableBalance;
    } else {
      // The backend caps a deallocation by the account's allocated balance
      return allocatedBalance;
    }
  }, [
    mode,
    availableBalance,
    allocatedBalance,
  ]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<AllocationFormData>({
    resolver: zodResolver(createAllocationSchema(maxAmount, t, baseCurrency)),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date(),
      notes: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      // Reset do form primeiro
      reset({
        description: "",
        amount: 0,
        date: new Date(),
        notes: "",
      });
      // Reset da máscara de moeda
      currencyMask.setValue("");
      // Track modal opened
      analyticsHelpers.logAllocationModalOpened(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset, mode]);

  // Atualizar validação quando maxAmount mudar (ex: quando selecionar um cartão diferente)
  useEffect(() => {
    // Revalidar o campo amount quando maxAmount mudar, mas apenas se já houver um valor
    const currentAmount = watch("amount");
    if (currentAmount > 0) {
      setValue("amount", currentAmount, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAmount]);

  const onSubmit = async (data: AllocationFormData) => {
    const finalCreditCardId = selectedCreditCardId || creditCardId;
    if (!accountId || !finalCreditCardId) {
      showError(t.accountAndCreditCardRequired);
      return;
    }

    try {
      if (mode === "allocate") {
        if (data.amount > availableBalance) {
          showError(t.insufficientAvailableBalance);
          return;
        }
        await createAllocation.mutateAsync({
          accountId,
          creditCardId: finalCreditCardId,
          amount: data.amount,
          description:
            data.description ||
            `${t.categoryALLOCATION}: ${account?.name} → ${selectedCreditCard?.name}`,
          date: formatDateForAPI(data.date),
          notes: data.notes,
        });
        analyticsHelpers.logAllocationCreated(data.amount, accountId, finalCreditCardId);
        success(t.allocationSuccess);
      } else {
        const maxDeallocate = allocatedBalance;
        if (data.amount > maxDeallocate) {
          const formattedMax = formatCurrency(maxDeallocate, baseCurrency);
          showError(
            `${t.insufficientAllocatedBalance}. ${t.maximumAvailable}: ${formattedMax}`
          );
          return;
        }
        await createDeallocation.mutateAsync({
          accountId,
          creditCardId: finalCreditCardId,
          amount: data.amount,
          description:
            data.description ||
            `${t.deallocateBalance}: ${selectedCreditCard?.name} → ${account?.name}`,
          date: formatDateForAPI(data.date),
          notes: data.notes,
        });
        analyticsHelpers.logDeallocationCreated(data.amount, accountId, finalCreditCardId);
        success(t.deallocationSuccess);
      }
      onClose();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t.errorProcessingAllocation;
      showError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        <div className="relative w-full sm:w-[450px] max-w-lg p-6 bg-surface-elevated max-h-[90vh] overflow-y-auto min-w-0 rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-content">
              {mode === "allocate" ? t.allocateBalance : t.deallocateBalance}
            </h3>
            <button
              onClick={onClose}
              aria-label={t.close}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {account && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">Conta:</span>
                <span className="font-medium text-content">
                  {account.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">
                  {t.totalBalance}:
                </span>
                <span className="font-medium text-content">
                  {formatCurrency(totalBalance, baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">
                  {t.availableBalance}:
                </span>
                <span className="font-medium text-positive">
                  {formatCurrency(availableBalance, baseCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">
                  {t.allocatedBalance}:
                </span>
                <span className="font-medium text-info">
                  {formatCurrency(allocatedBalance, baseCurrency)}
                </span>
              </div>
              {(mode === "allocate" || mode === "deallocate") &&
                creditCards.length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <label className="block text-sm font-medium text-content-secondary mb-1">
                      {t.creditCard}
                    </label>
                    <SelectCombobox
                      value={selectedCreditCardId || ""}
                      onValueChange={(newId) => {
                        const id = newId || null;
                        setSelectedCreditCardId(id);
                        if (onCreditCardSelect && id) {
                          onCreditCardSelect(id);
                        }
                      }}
                      options={[
                        { value: "", label: t.selectCreditCard },
                        ...creditCards.map((card) => ({
                          value: card.id || "",
                          label: card.name,
                        })),
                      ]}
                      placeholder={t.selectCreditCard}
                    />
                  </div>
                )}
              {selectedCreditCard && (
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {t.creditCard}:
                    </span>
                    <span className="font-medium text-content">
                      {selectedCreditCard.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {t.totalLimit}:
                    </span>
                    <span className="font-medium text-content">
                      {formatCurrency(creditCardLimit, baseCurrency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                {mode === "allocate" ? t.valueToAllocate : t.valueToDeallocate}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={currencyMask.value || ""}
                onChange={(e) => {
                  const newValue = e.target.value;
                  // Atualiza a máscara com o novo valor
                  currencyMask.onChange(e);
                  // Parseia o valor bruto do input para atualizar o form
                  const numericValue = parseCurrencyValue(newValue);
                  setValue("amount", numericValue, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                placeholder={t.currencyPlaceholder}
                autoComplete="off"
                className={`field-control ${
                  errors.amount
                    ? "border-negative/60"
                    : "border-line"
                }`}
              />
              <input
                type="hidden"
                {...register("amount", {
                  valueAsNumber: true,
                })}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.amount.message}
                </p>
              )}
              <p className="mt-1 text-xs text-content-tertiary">
                {mode === "allocate"
                  ? `${t.maximumAvailable}: ${formatCurrency(
                      availableBalance,
                      baseCurrency
                    )}`
                  : `${t.maximumAllocated}: ${formatCurrency(
                      allocatedBalance,
                      baseCurrency
                    )}`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                {t.description} ({t.optional})
              </label>
              <input
                type="text"
                {...register("description")}
                className="field-control"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                {t.date}
              </label>
              <DatePicker
                value={watch("date") || new Date()}
                onChange={(date) => {
                  setValue("date", date || new Date(), {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                placeholder={t.date}
                className={
                  errors.date ? "border-negative/60" : ""
                }
                useModal={true}
              />
              <input
                type="hidden"
                {...register("date", {
                  valueAsDate: true,
                })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                {t.notesOptional}
              </label>
              <textarea
                {...register("notes")}
                rows={3}
                className="field-control h-auto min-h-[88px] py-2.5"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
              >
                {isSubmitting
                  ? t.processing
                  : mode === "allocate"
                  ? t.allocate
                  : t.deallocate}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
