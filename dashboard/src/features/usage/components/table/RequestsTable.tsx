import { Select } from '../../../../shared/ui/Select';
import { IconButton } from '../../../../shared/ui/Button';
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
            <span className="text-[10px] text-[#758291] tabular-nums">
              {dateTime(info.getValue())}
            </span>
          ),
        }),
        helper.accessor('kind', {
          header: 'Operation',
          enableSorting: false,
          cell: (info) => (
            <span
              className={`inline-block rounded-[5px] px-1.75 py-0.75 text-[10px] ${info.getValue() === 'enhancement' ? 'bg-[#f1effa] text-[#8570b1]' : 'bg-[#edf4fb] text-[#5c7eab]'}`}
            >
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
            <span className="font-mono text-[10px]">
              {info.getValue() ?? 'Unknown'}
            </span>
          ),
        }),
        helper.accessor((row) => row.costUsd ?? undefined, {
          id: 'costUsd',
          header: 'Cost, USD',
          sortFn: 'basic',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="tabular-nums">
              {money(info.getValue() ?? null)}
            </span>
          ),
        }),
        helper.accessor((row) => row.durationSeconds ?? undefined, {
          id: 'durationSeconds',
          header: 'Audio',
          sortFn: 'basic',
          sortUndefined: 'last',
          cell: (info) => (
            <span className="tabular-nums text-muted">
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
            <span className="tabular-nums">
              {latency(info.getValue() ?? null)}
            </span>
          ),
        }),
        helper.accessor('text', {
          header: 'Result text',
          enableSorting: false,
          cell: (info) => (
            <span className="block max-w-62.5 overflow-hidden text-ellipsis">
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
            <IconButton
              aria-label={`View details ${info.row.original.key}`}
              onClick={() => setSelected(info.row.original)}
            >
              <ExternalLink size={15} />
            </IconButton>
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
    <div className="rounded-[11px] border border-border bg-white shadow-card">
      <div className="flex items-center justify-between gap-3.75 px-4.5 py-4.25 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2.25 [&_h3]:text-[13px] [&_p]:mt-1 [&_p]:text-[10px] [&_p]:text-muted">
        <div>
          <h3>
            Request log{' '}
            <span className="rounded-[5px] bg-[#f0f3f6] px-1.5 py-px text-[10px] text-muted">
              {requests.length}
            </span>
          </h3>
          <p>Sort by column. Hold Shift to sort by multiple columns.</p>
        </div>
        <details className="relative [&_summary]:list-none [&_summary]:text-[11px] [&_summary]:font-normal [&_summary::-webkit-details-marker]:hidden">
          <summary className="inline-flex items-center justify-center gap-1.75 rounded-[7px] border border-border bg-white px-3 py-2 text-[11px] font-normal whitespace-nowrap shadow-card hover:border-[#c9d7d3] hover:bg-[#f8fafb]">
            <Columns3 size={15} />
            Columns
          </summary>
          <div className="absolute top-9.75 right-0 z-4 max-h-82.5 w-58.75 overflow-auto rounded-[9px] border border-border bg-white p-3 shadow-[0_8px_25px_#182b3b15] [&_label]:flex [&_label]:items-center [&_label]:gap-2 [&_label]:py-1 [&_label]:text-[11px]">
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left whitespace-nowrap">
          <thead className="border-y border-border bg-[#f8fafb]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    className="px-3.25 py-2.5 text-[10px] font-medium text-[#728090] aria-[sort]:text-teal"
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
                      <button
                        className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-inherit"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-45" />
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
          <tbody className="[&_tr:hover]:bg-[#fbfcfd] [&_tr:last-child_td]:border-b-0">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    className="border-b border-[#f0f3f5] px-3.25 py-3 text-[11px]"
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!requests.length && (
              <tr>
                <td
                  className="border-b border-[#f0f3f5] px-3.25 py-3 text-[11px]"
                  colSpan={visibleColumns}
                >
                  <div className="px-3.75 py-8.75 text-center whitespace-normal [&_h3]:mb-1.25 [&_h3]:text-[14px] [&_p]:text-[12px] [&_p]:text-muted">
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
      <div className="flex items-center justify-between gap-3.75 border-t border-border px-4.25 py-3 text-[10px] text-muted max-[540px]:flex-col max-[540px]:items-stretch [&>div]:flex [&>div]:items-center [&>div]:gap-2.5 max-[540px]:[&>div]:justify-between max-[540px]:[&>div]:gap-1 [&_label]:flex [&_label]:items-center [&_label]:gap-1.75 max-[540px]:[&_label]:gap-1 max-[540px]:[&_label]:text-[9px]">
        <span>
          {requests.length
            ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, requests.length)} of ${requests.length}`
            : '0 requests'}
        </span>
        <div>
          <label>
            Rows per page{' '}
            <Select
              aria-label="Rows per page"
              value={pageSize}
              onValueChange={table.setPageSize}
              size="small"
              options={[10, 25, 50, 100].map((value) => ({
                value,
                label: String(value),
              }))}
            />
          </label>
          <span>
            Page {requests.length ? pageIndex + 1 : 0} of {table.getPageCount()}
          </span>
          <IconButton
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={17} />
          </IconButton>
          <IconButton
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={17} />
          </IconButton>
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
    <span className="mb-3.5 inline-flex rounded-full bg-[#f1f5f7] p-3.75 text-[#91a0ac]">
      <ArrowUpDown size={25} />
    </span>
  );
}
