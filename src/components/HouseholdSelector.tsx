import { useState } from 'react';
import { ChevronDown, Users, Plus, Settings } from 'lucide-react';
import { useHouseholds } from '../hooks/api/useHouseholds';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { saveHouseholdToLocalStorage } from '../utils/householdStorage';
import { CreateHouseholdModal } from './CreateHouseholdModal';
import { HouseholdMembersModal } from './HouseholdMembersModal';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../context/I18nContext';

interface HouseholdSelectorProps {
  collapsed?: boolean;
}

export function HouseholdSelector({ collapsed = false }: HouseholdSelectorProps) {
  const { t } = useI18n();
  const { data: households, isLoading } = useHouseholds();
  const { householdId: currentHouseholdId, household: currentHousehold } = useDefaultHousehold();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedHouseholdForMembers, setSelectedHouseholdForMembers] = useState<{ id: string; role: 'OWNER' | 'EDITOR' | 'VIEWER' } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Separate personal and shared households
  // Personal: the first household (oldest by createdAt) - typically the one created during onboarding
  // Shared: all other households
  // IMPORTANT: Create a copy before sorting to avoid mutating the original array
  // Filter out invalid households (empty objects or those without id)
  const sortedHouseholds = households && Array.isArray(households) 
    ? [...households]
        .filter((h) => {
          // Filter out invalid households: empty objects, null, undefined, or missing id
          if (!h || typeof h !== 'object') return false;
          if (Object.keys(h).length === 0) return false; // Empty object {}
          return h.id && typeof h.id === 'string' && h.id.length > 0;
        })
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || a.joinedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.joinedAt || 0).getTime();
          return dateA - dateB;
        })
    : [];

  const personalHouseholds = sortedHouseholds.length > 0 ? [sortedHouseholds[0]] : [];
  const sharedHouseholds = sortedHouseholds.slice(1).filter((h) => h && h.id && typeof h.id === 'string'); // Extra safety filter

  const handleHouseholdChange = async (householdId: string) => {
    if (!householdId) {
      return;
    }

    const selectedHousehold = households?.find((h) => h?.id === householdId);
    if (!selectedHousehold || !selectedHousehold.id) {
      return;
    }

    try {
      // CRITICAL: Save to localStorage FIRST - this is the source of truth
      // The saveHouseholdToLocalStorage function dispatches a custom event
      // which will trigger useDefaultHousehold to update immediately
      saveHouseholdToLocalStorage(selectedHousehold.id, selectedHousehold.name, selectedHousehold.role);
      
      setIsDropdownOpen(false);
      
      // Small delay to allow the custom event to propagate and useDefaultHousehold to update
      // This ensures the householdId is updated in the hook before we invalidate queries
      requestAnimationFrame(() => {
        // Remove all cached queries related to the OLD household to force fresh data
        // This ensures we don't see stale data from the previous household
        queryClient.removeQueries({ queryKey: ['transactions'], exact: false });
        queryClient.removeQueries({ queryKey: ['accounts'], exact: false });
        queryClient.removeQueries({ queryKey: ['budgets'], exact: false });
        queryClient.removeQueries({ queryKey: ['recurring-transactions'], exact: false });
        queryClient.removeQueries({ queryKey: ['savings-goals'], exact: false });
        queryClient.removeQueries({ queryKey: ['categories'], exact: false });
        
        // Invalidate queries to trigger refetch with new householdId
        // The TransactionsContext will automatically refetch when useDefaultHousehold returns the new householdId
        queryClient.invalidateQueries({ queryKey: ['households'] });
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        
        // Force refetch of all data queries - they will use the new householdId from useDefaultHousehold
        // This ensures immediate data refresh without reload
        queryClient.refetchQueries({ queryKey: ['transactions'], exact: false });
        queryClient.refetchQueries({ queryKey: ['accounts'], exact: false });
        queryClient.refetchQueries({ queryKey: ['budgets'], exact: false });
        queryClient.refetchQueries({ queryKey: ['recurring-transactions'], exact: false });
        queryClient.refetchQueries({ queryKey: ['savings-goals'], exact: false });
      });
      
    } catch (error) {
      setIsDropdownOpen(false);
    }
  };

  const canCreateShared = sharedHouseholds.length === 0;

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-sm text-content-tertiary">
        {t.loading}
      </div>
    );
  }

  if (collapsed) {
    return (
      <>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-center p-2 text-sm font-light text-content bg-surface-elevated border border-line-subtle rounded-lg hover:opacity-70 transition-opacity"
            title={currentHousehold?.name || households?.find(h => h?.id === currentHouseholdId)?.name || t.myFinances}
          >
            <Users className="h-5 w-5" />
          </button>

          {isDropdownOpen && households && (
            <>
              <div
                className="fixed inset-0 z-[45] bg-transparent"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div 
                className="absolute z-[60] left-full ml-2 bottom-full mb-2 w-64 bg-surface-elevated border border-line-subtle rounded-lg max-h-[calc(100vh-200px)] overflow-y-auto"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Personal Household */}
                {personalHouseholds.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1.5 text-xs font-medium text-content-secondary uppercase mb-1">
                      {t.householdTypeIndividual}
                    </div>
                    {personalHouseholds.map((household) => {
                      if (!household?.id) return null;
                      return (
                        <button
                          key={household.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHouseholdChange(household.id);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors cursor-pointer relative z-50 my-1 ${
                            household.id === currentHouseholdId
                              ? 'bg-surface-elevated text-brand font-light border border-primary-500 dark:border-primary-500'
                              : 'text-content hover:bg-surface-sunken font-light'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{household.name || `Household ${household.id?.slice(0, 8) || 'N/A'}`}</span>
                            {household.id === currentHouseholdId && (
                              <span className="ml-2 text-xs text-brand flex-shrink-0">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Shared Households */}
                {sharedHouseholds.length > 0 && (
                  <div className="p-2 border-t border-line-subtle">
                    <div className="px-3 py-1.5 text-xs font-medium text-content-secondary uppercase mb-1">
                      {t.householdTypeShared}
                    </div>
                    {sharedHouseholds.map((household) => {
                      if (!household?.id) return null;
                      return (
                        <div key={household.id} className="group relative z-50">
                          <div
                            className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors cursor-pointer relative z-50 my-1 flex items-center justify-between ${
                              household.id === currentHouseholdId
                                ? 'bg-surface-elevated text-brand font-light border border-primary-500 dark:border-primary-500'
                                : 'text-content hover:bg-surface-sunken font-light'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHouseholdChange(household.id);
                              }}
                              className="flex items-center space-x-2 min-w-0 flex-1 text-left"
                            >
                              <Users className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{household.name || `Household ${household.id?.slice(0, 8) || 'N/A'}`}</span>
                            </button>
                            <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                              {household.id === currentHouseholdId && (
                                <span className="text-xs text-brand">✓</span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHouseholdForMembers({ id: household.id, role: household.role });
                                  setIsMembersModalOpen(true);
                                  setIsDropdownOpen(false);
                                }}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:opacity-70 transition-opacity rounded cursor-pointer relative z-50"
                                title={household.role === 'OWNER' ? t.manageMembersAndSharedAccounts : t.manageMySharedAccounts}
                              >
                                <Settings className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Create Shared Household Button */}
                {canCreateShared && (
                  <div className="p-2 border-t border-line-subtle">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center px-3 py-2 text-sm font-light text-brand hover:opacity-70 transition-opacity rounded-md"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t.createSharedHousehold}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <CreateHouseholdModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />

        {selectedHouseholdForMembers && (
          <HouseholdMembersModal
            isOpen={isMembersModalOpen}
            onClose={() => {
              setIsMembersModalOpen(false);
              setSelectedHouseholdForMembers(null);
            }}
            householdId={selectedHouseholdForMembers.id}
            userRole={selectedHouseholdForMembers.role}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-light text-content bg-surface-elevated border border-line-subtle rounded-lg hover:opacity-70 transition-opacity"
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="truncate" title={currentHousehold?.name || households?.find(h => h?.id === currentHouseholdId)?.name || t.myFinances}>
              {currentHousehold?.name || households?.find(h => h?.id === currentHouseholdId)?.name || t.myFinances}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && households && (
          <>
            <div
              className="fixed inset-0 z-[45] bg-transparent"
              onClick={() => setIsDropdownOpen(false)}
            />
            <div 
              className="absolute z-[60] w-full bottom-full mb-2 bg-surface-elevated border border-line-subtle rounded-lg max-h-[calc(100vh-200px)] overflow-y-auto"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Personal Household */}
              {personalHouseholds.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-content-secondary uppercase mb-1">
                    {t.householdTypeIndividual}
                  </div>
                  {personalHouseholds.map((household) => {
                    if (!household?.id) return null;
                    return (
                      <button
                        key={household.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHouseholdChange(household.id);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors cursor-pointer relative z-50 my-1 ${
                          household.id === currentHouseholdId
                            ? 'bg-surface-elevated text-brand font-light border border-primary-500 dark:border-primary-500'
                            : 'text-content hover:bg-surface-sunken font-light'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{household.name || `Household ${household.id?.slice(0, 8) || 'N/A'}`}</span>
                          {household.id === currentHouseholdId && (
                            <span className="ml-2 text-xs text-brand flex-shrink-0">✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Shared Households */}
              {sharedHouseholds.length > 0 && (
                <div className="p-2 border-t border-line-subtle">
                  <div className="px-3 py-1.5 text-xs font-medium text-content-secondary uppercase mb-1">
                    {t.householdTypeShared}
                  </div>
                  {sharedHouseholds.map((household) => {
                    if (!household?.id) return null;
                    return (
                      <div key={household.id} className="group relative z-50">
                        <div
                          className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors cursor-pointer relative z-50 my-1 flex items-center justify-between ${
                            household.id === currentHouseholdId
                              ? 'bg-surface-elevated text-brand font-light border border-primary-500 dark:border-primary-500'
                              : 'text-content hover:bg-surface-sunken font-light'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHouseholdChange(household.id);
                            }}
                            className="flex items-center space-x-2 min-w-0 flex-1 text-left"
                          >
                            <Users className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{household.name || `Household ${household.id?.slice(0, 8) || 'N/A'}`}</span>
                          </button>
                          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                            {household.id === currentHouseholdId && (
                              <span className="text-xs text-brand">✓</span>
                            )}
                            {/* Allow all members (OWNER, EDITOR, VIEWER) to open members modal to manage their own account sharing */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHouseholdForMembers({ id: household.id, role: household.role });
                                setIsMembersModalOpen(true);
                                setIsDropdownOpen(false);
                              }}
                              className="p-1 opacity-0 group-hover:opacity-100 hover:opacity-70 transition-opacity rounded cursor-pointer relative z-50"
                              title={household.role === 'OWNER' ? t.manageMembersAndSharedAccounts : t.manageMySharedAccounts}
                            >
                              <Settings className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create Shared Household Button */}
              {canCreateShared && (
                <div className="p-2 border-t border-line-subtle">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center px-3 py-2 text-sm font-light text-brand hover:opacity-70 transition-opacity rounded-md"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.createSharedHousehold}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CreateHouseholdModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {selectedHouseholdForMembers && (
        <HouseholdMembersModal
          isOpen={isMembersModalOpen}
          onClose={() => {
            setIsMembersModalOpen(false);
            setSelectedHouseholdForMembers(null);
          }}
          householdId={selectedHouseholdForMembers.id}
          userRole={selectedHouseholdForMembers.role}
        />
      )}
    </>
  );
}
