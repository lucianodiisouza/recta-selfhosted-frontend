import { Account } from '../types';

/**
 * Calculate account balances - SINGLE SOURCE OF TRUTH
 * 
 * Rules:
 * - totalBalance: Always totalBalance from backend, or calculate as availableBalance + allocatedBalance
 * - availableBalance: Always availableBalance from backend, or calculate as totalBalance - allocatedBalance
 * - allocatedBalance: Always allocatedBalance from backend, or 0
 */
export interface AccountBalance {
  totalBalance: number;
  availableBalance: number;
  allocatedBalance: number;
}

/**
 * Get account balances - SINGLE SOURCE OF TRUTH for all frontend balance calculations
 * 
 * @param account - Account object from backend
 * @returns Calculated balances with consistent logic
 */
export function getAccountBalance(account: Account | null | undefined): AccountBalance {
  if (!account) {
    return {
      totalBalance: 0,
      availableBalance: 0,
      allocatedBalance: 0,
    };
  }

  // allocatedBalance: Always use from backend, or 0
  const allocatedBalance = account.allocatedBalance !== undefined && account.allocatedBalance !== null
    ? account.allocatedBalance
    : 0;

  // totalBalance: Use from backend if available, otherwise calculate from available + allocated
  let totalBalance: number;
  if (account.totalBalance !== undefined && account.totalBalance !== null) {
    totalBalance = account.totalBalance;
  } else if (account.availableBalance !== undefined || account.allocatedBalance !== undefined) {
    // Calculate as availableBalance + allocatedBalance
    const available = account.availableBalance ?? 0;
    const allocated = account.allocatedBalance ?? 0;
    totalBalance = available + allocated;
  } else {
    // Fallback to legacy balance
    totalBalance = account.balance ?? 0;
  }

  // availableBalance: Use from backend if available, otherwise calculate from total - allocated
  let availableBalance: number;
  if (account.availableBalance !== undefined && account.availableBalance !== null) {
    availableBalance = account.availableBalance;
  } else {
    // Calculate as totalBalance - allocatedBalance
    availableBalance = Math.max(0, totalBalance - allocatedBalance);
  }

  // Ensure consistency: totalBalance = availableBalance + allocatedBalance
  // This fixes any inconsistencies from backend
  const correctTotal = availableBalance + allocatedBalance;
  
  return {
    totalBalance: correctTotal, // Always ensure consistency
    availableBalance,
    allocatedBalance,
  };
}

/**
 * Get total balance for display (for non-credit accounts)
 * For credit cards, returns the debt (positive balance)
 */
export function getDisplayBalance(account: Account | null | undefined): number {
  const balances = getAccountBalance(account);
  return balances.totalBalance;
}

/**
 * Get available balance for operations (allocation, transfer, etc)
 */
export function getAvailableBalance(account: Account | null | undefined): number {
  const balances = getAccountBalance(account);
  return balances.availableBalance;
}

/**
 * Get allocated balance
 */
export function getAllocatedBalance(account: Account | null | undefined): number {
  const balances = getAccountBalance(account);
  return balances.allocatedBalance;
}

export interface CreditCardUsage {
  limit: number;
  used: number;
  available: number;
  usagePercent: number;
}

/**
 * Credit card limit usage from the backend's stored available limit, which already
 * accounts for every purchase (paid or pending) and payment. Falls back to the debt
 * (positive balance) only when the backend has not filled availableLimit.
 */
export function getCreditCardUsage(card: Account | null | undefined): CreditCardUsage {
  const limit = card?.totalLimit || card?.creditLimit || 0;
  if (!card) return { limit: 0, used: 0, available: 0, usagePercent: 0 };
  const debt = Math.max(0, getAccountBalance(card).totalBalance);
  const available = card.availableLimit !== undefined && card.availableLimit !== null
    ? Math.max(0, card.availableLimit)
    : Math.max(0, limit - debt);
  const used = Math.max(0, limit - available);
  const usagePercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return { limit, used, available, usagePercent };
}
