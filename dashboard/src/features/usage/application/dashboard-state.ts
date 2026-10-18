import { emptyFilters } from '../domain/filters';
import type { UsageFilters } from '../domain/types';

export interface DashboardState {
  linked: boolean;
  tableFilters: UsageFilters;
  dashboardFilters: UsageFilters;
}
export type DashboardAction =
  | { type: 'table' | 'dashboard'; filters: UsageFilters }
  | { type: 'link'; linked: boolean };

export function initialDashboardState(): DashboardState {
  return {
    linked: true,
    tableFilters: emptyFilters(),
    dashboardFilters: emptyFilters(),
  };
}

export function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  if (action.type === 'link') {
    return {
      ...state,
      linked: action.linked,
      dashboardFilters: structuredClone(state.tableFilters),
    };
  }
  if (state.linked)
    return {
      ...state,
      tableFilters: action.filters,
      dashboardFilters: action.filters,
    };
  return action.type === 'table'
    ? { ...state, tableFilters: action.filters }
    : { ...state, dashboardFilters: action.filters };
}
