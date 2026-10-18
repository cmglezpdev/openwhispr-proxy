import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
} from 'lucide-react';
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { UsageRequest } from '../../domain/types';
import { dateTime, duration, latency, money } from '../../../../shared/format';
import { RequestDetail } from './RequestDetail';

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
});
const helper = createColumnHelper<typeof features, UsageRequest>();

export function RequestsTable({ requests }: { requests: UsageRequest[] }) {
  const [selected, setSelected] = useState<UsageRequest | null>(null);
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('createdAt', {
          header: 'Date',
          sortFn: 'text',
          cell: (info) => (
            <span className="date-cell">{dateTime(info.getValue())}</span>
          ),
        }),
        helper.accessor('kind', {
          header: 'Operation',
          enableSorting: false,
          cell: (info) => (
            <span className={`type-badge ${info.getValue()}`}>
              {info.getValue() === 'transcription'
                ? 'Transcription'
                : 'Text enhancement'}
            </span>
          ),
        }),
        helper.accessor((row) => row.model ?? undefined, {
          id: 'model',
          header: 'Model',
          sortFn: 'text',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="model-cell">{info.getValue() ?? 'Unknown'}</span>
          ),
        }),
        helper.accessor((row) => row.costUsd ?? undefined, {
          id: 'costUsd',
          header: 'Cost, USD',
          sortFn: 'basic',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="numeric">{money(info.getValue() ?? null)}</span>
          ),
        }),
        helper.accessor((row) => row.durationSeconds ?? undefined, {
          id: 'durationSeconds',
          header: 'Audio',
          sortFn: 'basic',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="numeric muted">
              {info.row.original.kind === 'enhancement'
                ? 'Not applicable'
                : duration(info.getValue() ?? null)}
            </span>
          ),
        }),
        helper.accessor((row) => row.latencyMs ?? undefined, {
          id: 'latencyMs',
          header: 'Latency',
          sortFn: 'basic',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="numeric">{latency(info.getValue() ?? null)}</span>
          ),
        }),
        helper.accessor('text', {
          header: 'Result text',
          enableSorting: false,
          cell: (info) => (
            <span className="text-preview">
              {info.getValue() ?? 'No result'}
            </span>
          ),
        }),
        helper.accessor('generationId', {
          header: 'Generation ID',
          enableSorting: false,
          cell: (info) => <code>{info.getValue() ?? 'No data'}</code>,
        }),
        helper.accessor('id', { header: 'ID', enableSorting: false }),
        helper.accessor('key', {
          header: 'Row key',
          enableSorting: false,
        }),
        helper.display({
          id: 'detail',
          header: '',
          enableHiding: false,
          cell: (info) => (
            <button
              className="icon-button"
              aria-label={`View details ${info.row.original.key}`}
              onClick={() => setSelected(info.row.original)}
            >
              <ExternalLink size={15} />
            </button>
          ),
        }),
      ]),
    [],
  );
  const table = useTable({
    features,
    columns,
    data: requests,
    getRowId: (row) => row.key,
    initialState: {
      sorting: [{ id: 'createdAt', desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
      columnVisibility: {
        text: false,
        generationId: false,
        id: false,
        key: false,
      },
    },
    defaultColumn: { sortDescFirst: false },
  });
  const visibleColumns = table.getVisibleLeafColumns().length;
  const { pageIndex, pageSize } = table.state.pagination;
  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div>
          <h3>
            Request log <span className="count-pill">{requests.length}</span>
          </h3>
          <p>Sort by column. Hold Shift to sort by multiple columns.</p>
        </div>
        <details className="column-menu">
          <summary className="button">
            <Columns3 size={15} />
            Columns
          </summary>
          <div className="column-options">
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <label key={column.id}>
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                  />
                  {String(column.columnDef.header)}
                </label>
              ))}
          </div>
        </details>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={12} className="sort-idle" />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!requests.length && (
              <tr>
                <td colSpan={visibleColumns}>
                  <div className="table-empty">
                    <SearchEmpty />
                    <h3>No matching requests</h3>
                    <p>Try another date range or clear the filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>
          {requests.length
            ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, requests.length)} of ${requests.length}`
            : '0 requests'}
        </span>
        <div>
          <label>
            Rows per page{' '}
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) =>
                table.setPageSize(Number(event.target.value))
              }
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span>
            Page {requests.length ? pageIndex + 1 : 0} of {table.getPageCount()}
          </span>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {selected && (
        <RequestDetail request={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SearchEmpty() {
  return (
    <span className="empty-glyph">
      <ArrowUpDown size={25} />
    </span>
  );
}
