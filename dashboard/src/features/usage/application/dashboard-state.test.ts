import { expect, it } from 'vitest';
import { emptyFilters } from '../domain/filters';
import { dashboardReducer, initialDashboardState } from './dashboard-state';

it('shares filters until unlinked and restores the table selection on relink', () => {
  let state = initialDashboardState();
  const shared = { ...emptyFilters(), kind: 'transcription' as const };
  state = dashboardReducer(state, { type: 'dashboard', filters: shared });
  expect(state.tableFilters).toEqual(shared);
  state = dashboardReducer(state, { type: 'link', linked: false });
  expect(state.dashboardFilters).toEqual(shared);
  expect(state.dashboardFilters).not.toBe(state.tableFilters);
  state = dashboardReducer(state, {
    type: 'dashboard',
    filters: { ...shared, kind: 'enhancement' },
  });
  expect(state.tableFilters.kind).toBe('transcription');
  state = dashboardReducer(state, {
    type: 'table',
    filters: { ...shared, query: 'meeting' },
  });
  expect(state.dashboardFilters.query).toBe('');
  state = dashboardReducer(state, { type: 'link', linked: true });
  expect(state.dashboardFilters).toEqual(state.tableFilters);
  expect(state.dashboardFilters.kind).toBe('transcription');
  expect(state.dashboardFilters.query).toBe('meeting');
});
