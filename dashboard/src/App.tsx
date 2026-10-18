import { Button } from './shared/ui/Button';
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
import { SpeakingStats } from './features/usage/components/summary/SpeakingStats';
import { ActivityHeatmap } from './features/usage/components/charts/ActivityHeatmap';
import { TimelineChart } from './features/usage/components/charts/TimelineChart';
import { ComparisonChart } from './features/usage/components/charts/ComparisonChart';
import { RequestsTable } from './features/usage/components/table/RequestsTable';
import { dateTime } from './shared/format';

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
      <header className="flex h-17 items-center gap-10.5 border-b border-border bg-white px-[4%] max-[800px]:gap-5.5 max-[540px]:h-15 max-[540px]:gap-3.75 max-[540px]:px-4.25">
        <a
          href="#overview"
          className="flex items-center gap-2.25 text-[17px] font-[720] tracking-[-0.5px] max-[540px]:text-[15px]"
        >
          <span className="grid size-8.25 place-items-center rounded-[10px] bg-teal text-white">
            <AudioLines size={22} />
          </span>
          OpenWhispr{' '}
          <span className="ml-0.5 border-l border-border pl-2.5 text-[14px] font-[450] tracking-normal text-muted max-[540px]:hidden">
            Proxy
          </span>
        </a>
        <nav
          className="flex gap-6.25 text-[13px] text-muted max-[540px]:hidden [&_a:hover]:text-teal"
          aria-label="Sections"
        >
          <a href="#overview">Overview</a>
          <a href="#requests">Requests</a>
        </nav>
        <span className="ml-auto flex items-center gap-1.75 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted max-[540px]:text-[10px] [&>span]:size-1.5 [&>span]:rounded-full [&>span]:bg-[#29a27d]">
          <span />
          Local session
        </span>
      </header>
      <main className="mx-auto max-w-375 px-[4%] pt-9.5 pb-5 max-[800px]:pt-6.25 max-[540px]:px-3.75">
        <div className="mb-6.25 flex items-center justify-between gap-5 max-[540px]:flex-col max-[540px]:items-start max-[540px]:gap-3.75">
          <div>
            <div className="flex items-center gap-1.75 text-[10px] font-[650] tracking-[1.5px] mb-2 text-teal">
              <Activity size={13} />
              PROXY ACTIVITY
            </div>
            <h1 className="text-[clamp(25px,3vw,32px)] leading-tight font-[650] tracking-[-1.1px] max-[540px]:text-[27px]">
              Your history, in perspective.
            </h1>
            <p className="mt-2 text-[13px] text-muted">
              Explore your requests and understand your usage.
            </p>
          </div>
          <Button
            className="max-[540px]:text-[11px]"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={15} />
            Reload data
          </Button>
        </div>
        {error ? (
          <div
            className="flex min-h-87.5 flex-col items-center justify-center gap-3.25 text-muted [&_h2]:text-text"
            role="alert"
          >
            <h2>Could not load request history</h2>
            <p>{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : !snapshot ? (
          <div
            className="flex min-h-87.5 flex-col items-center justify-center gap-3.25 text-muted"
            role="status"
          >
            <span className="size-6.25 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-border border-t-teal motion-reduce:animate-none" />
            <p>Loading request history…</p>
          </div>
        ) : (
          <>
            <div className="mb-6.75 flex justify-between gap-2.5 text-[11px] text-muted max-[800px]:flex-col max-[800px]:gap-1.25">
              <span>
                {snapshot.requests.length.toLocaleString('en-US')} requests
                loaded · {dateTime(snapshot.loadedAt)}
              </span>
              <span>
                Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            <section id="overview">
              <div className="mb-3.75 flex items-center justify-between gap-3.75 max-[540px]:flex-col max-[540px]:items-start max-[540px]:gap-2.5 [&_p]:mt-0.75 [&_p]:text-[12px] [&_p]:text-muted">
                <div>
                  <h2>Activity overview</h2>
                  <p>Totals and charts reflect the entire selection.</p>
                </div>
                <button
                  className="flex items-center gap-1.75 rounded-[7px] border border-border bg-white px-2.5 py-1.75 text-[11px] text-muted aria-pressed:border-[#c7e1d9] aria-pressed:bg-teal-light aria-pressed:text-teal"
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
                <p className="my-2.5 text-[11px] text-muted">
                  The dashboard uses its own filters. Linking it again applies
                  the table filters.
                </p>
              )}
              <SummaryCards
                requests={dashboardRequests}
                filters={state.dashboardFilters}
              />
              <SpeakingStats
                requests={dashboardRequests}
                history={snapshot.requests}
                filters={state.dashboardFilters}
              />
              <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-4.25 max-[1150px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] max-[800px]:grid-cols-1">
                <TimelineChart
                  requests={dashboardRequests}
                  filters={state.dashboardFilters}
                />
                <ComparisonChart requests={dashboardRequests} />
              </div>
              <ActivityHeatmap
                requests={dashboardRequests}
                filters={state.dashboardFilters}
              />
            </section>
            <section id="requests" className="mt-8 [&>section]:mb-3.75">
              <div className="mb-3.75 flex items-center justify-between gap-3.75 max-[540px]:flex-col max-[540px]:items-start max-[540px]:gap-2.5 [&_p]:mt-0.75 [&_p]:text-[12px] [&_p]:text-muted">
                <div>
                  <h2>Requests</h2>
                  <p>
                    {state.linked
                      ? 'The same selection shown in the overview.'
                      : 'This selection is independent of the dashboard.'}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
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
            <footer className="flex justify-between gap-3.75 pt-6.25 text-[10px] text-[#8a96a3] max-[800px]:flex-col max-[800px]:gap-1.25">
              <span>
                OpenWhispr Proxy <span className="mx-1.75">·</span> Data from
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
