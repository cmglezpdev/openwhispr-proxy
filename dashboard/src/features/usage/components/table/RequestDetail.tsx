import type { RequestDetailProps } from '../types';
import { Button, IconButton } from '../../../../shared/ui/Button';
import { useEffect, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { dateTime, duration, latency, money } from '../../../../shared/format';

export function RequestDetail({ request, onClose }: RequestDetailProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState('Copy details');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const fields = [
    ['Row key', request.key],
    ['ID within table', String(request.id)],
    [
      'Operation',
      request.kind === 'transcription' ? 'Transcription' : 'Text enhancement',
    ],
    ['Local date', dateTime(request.createdAt)],
    ['UTC date', request.createdAt],
    ['Model', request.model ?? 'Unknown'],
    ['Recorded cost, USD', money(request.costUsd)],
    ['Latency', latency(request.latencyMs)],
    [
      'Audio duration',
      request.kind === 'enhancement'
        ? 'Not applicable'
        : duration(request.durationSeconds),
    ],
    ['Generation ID', request.generationId ?? 'No data'],
  ];
  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
      setCopied('Copied');
    } catch {
      setCopied('Could not copy');
    }
  }
  return (
    <dialog
      ref={dialog}
      className="m-auto max-h-[88vh] w-[min(760px,calc(100%-30px))] rounded-[14px] border border-border p-0 text-text shadow-[0_20px_90px_#152a3c40] backdrop:bg-[#182f4260] backdrop:backdrop-blur-[3px]"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="request-detail-title"
    >
      <div className="flex items-center justify-between gap-3.75 border-b border-border px-6.25 py-5.5 max-[540px]:p-4.5 [&_h2]:mt-1.25 [&_h2]:text-[19px] [&_h2]:wrap-anywhere">
        <div>
          <span className="flex items-center gap-1.75 text-[10px] font-[650] tracking-[1.5px] text-muted">
            REQUEST DETAILS
          </span>
          <h2 id="request-detail-title">{request.model ?? 'Unknown model'}</h2>
        </div>
        <IconButton aria-label="Close details" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-4 px-6.25 py-5 max-[540px]:grid-cols-1 [&_dt]:mb-1 [&_dt]:text-[11px] [&_dt]:text-muted [&_dd]:m-0 [&_dd]:text-[12px] [&_dd]:wrap-anywhere">
        {fields.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {request.text !== null && (
        <section className="mb-2.5 text-[12px] [&_h3]:mb-2.5 [&_h3]:text-[12px] [&_pre]:m-0 [&_pre]:leading-[1.8] [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere">
          <h3>Result text</h3>
          <pre>{request.text}</pre>
        </section>
      )}
      <div className="sticky bottom-0 flex justify-between border-t border-border bg-white px-6.25 py-3.5">
        <Button onClick={() => void copy()}>
          <Copy size={15} />
          {copied}
        </Button>
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </dialog>
  );
}
