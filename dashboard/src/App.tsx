import { useMemo, useReducer } from 'react';
import { Activity, AudioLines, Link2, RefreshCw, Unlink2 } from 'lucide-react';
import {
  dashboardReducer,
  initialDashboardState,
} from './features/usage/application/dashboard-state';
import { useUsage } from './features/usage/application/use-usage';
import { loadUsage } from './features/usage/infrastructure/usage-api';
import { filterRequests } from './features/usage/domain/filters';
import { FiltersPanel } from './features/usage/components/filters/FiltersPanel';
import { SummaryCards } from './features/usage/components/summary/SummaryCards';
import { TimelineChart } from './features/usage/components/charts/TimelineChart';
import { ComparisonChart } from './features/usage/components/charts/ComparisonChart';
import { RequestsTable } from './features/usage/components/table/RequestsTable';
import { dateTime } from './shared/format';
import './styles/dashboard.css';

export default function App() {
  const { snapshot, error } = useUsage(loadUsage);
  const [state, dispatch] = useReducer(
    dashboardReducer,
    undefined,
    initialDashboardState,
  );
  const requests = snapshot?.requests;
  const models = useMemo(
    () =>
      Array.from(new Set(requests?.map((row) => row.model ?? '') ?? [])).sort(),
    [requests],
  );
  const tableRequests = useMemo(
    () => filterRequests(requests ?? [], state.tableFilters),
    [requests, state.tableFilters],
  );
  const dashboardRequests = useMemo(
    () => filterRequests(requests ?? [], state.dashboardFilters),
    [requests, state.dashboardFilters],
  );
  return (
    <>
      <header className="topbar">
        <a href="#overview" className="brand">
          <span className="brand-icon">
            <AudioLines size={22} />
          </span>
          OpenWhispr <span className="brand-product">Proxy</span>
        </a>
        <nav aria-label="Sections">
          <a href="#overview">Overview</a>
          <a href="#requests">Requests</a>
        </nav>
        <span className="local-badge">
          <span />
          Local session
        </span>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <Activity size={13} />
              PROXY ACTIVITY
            </div>
            <h1>Your history, in perspective.</h1>
            <p>Explore your requests and understand your usage.</p>
          </div>
          <button
            className="button refresh-button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={15} />
            Reload data
          </button>
        </div>
        {error ? (
          <div className="load-state error-state" role="alert">
            <h2>Could not load request history</h2>
            <p>{error}</p>
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : !snapshot ? (
          <div className="load-state" role="status">
            <span className="loading-spinner" />
            <p>Loading request history…</p>
          </div>
        ) : (
          <>
            <div className="snapshot-info">
              <span>
                {snapshot.requests.length.toLocaleString('en-US')} requests
                loaded · {dateTime(snapshot.loadedAt)}
              </span>
              <span>
                Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            <section id="overview" className="overview-section">
              <div className="section-heading">
                <div>
                  <h2>Activity overview</h2>
                  <p>Totals and charts reflect the entire selection.</p>
                </div>
                <button
                  className={`link-toggle ${state.linked ? 'is-linked' : ''}`}
                  aria-pressed={state.linked}
                  onClick={() =>
                    dispatch({ type: 'link', linked: !state.linked })
                  }
                >
                  {state.linked ? <Link2 size={16} /> : <Unlink2 size={16} />}
                  {state.linked ? 'Linked to table' : 'Independent filters'}
                </button>
              </div>
              <FiltersPanel
                label={state.linked ? 'Shared filters' : 'Dashboard filters'}
                filters={state.dashboardFilters}
                onChange={(filters) => dispatch({ type: 'dashboard', filters })}
                models={models}
                count={dashboardRequests.length}
                total={snapshot.requests.length}
              />
              {!state.linked && (
                <p className="independent-note">
                  The dashboard uses its own filters. Linking it again applies
                  the table filters.
                </p>
              )}
              <SummaryCards requests={dashboardRequests} />
              <div className="charts-grid">
                <TimelineChart
                  requests={dashboardRequests}
                  filters={state.dashboardFilters}
                />
                <ComparisonChart requests={dashboardRequests} />
              </div>
            </section>
            <section id="requests" className="requests-section">
              <div className="section-heading">
                <div>
                  <h2>Requests</h2>
                  <p>
                    {state.linked
                      ? 'The same selection shown in the overview.'
                      : 'This selection is independent of the dashboard.'}
                  </p>
                </div>
                <span className="selection-note">
                  {state.linked ? <Link2 size={14} /> : <Unlink2 size={14} />}
                  {state.linked ? 'Shared filters' : 'Separate filters'}
                </span>
              </div>
              {!state.linked && (
                <FiltersPanel
                  label="Table filters"
                  filters={state.tableFilters}
                  onChange={(filters) => dispatch({ type: 'table', filters })}
                  models={models}
                  count={tableRequests.length}
                  total={snapshot.requests.length}
                />
              )}
              <RequestsTable requests={tableRequests} />
            </section>
            <footer className="page-footer">
              <span>
                OpenWhispr Proxy <span className="footer-dot">·</span> Data from
                your local SQLite database
              </span>
              <span>
                Unknown costs are not treated as zero. Reload to see new
                requests.
              </span>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
