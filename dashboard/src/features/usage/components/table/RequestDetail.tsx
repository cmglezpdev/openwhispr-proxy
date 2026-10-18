import { useEffect, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { UsageRequest } from '../../domain/types';
import { dateTime, duration, latency, money } from '../../../../shared/format';

export function RequestDetail({
  request,
  onClose,
}: {
  request: UsageRequest;
  onClose: () => void;
}) {
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
      className="request-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="request-detail-title"
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">REQUEST DETAILS</span>
          <h2 id="request-detail-title">{request.model ?? 'Unknown model'}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <dl className="detail-fields">
        {fields.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {request.text !== null && (
        <section className="detail-text">
          <h3>Result text</h3>
          <pre>{request.text}</pre>
        </section>
      )}
      <div className="dialog-footer">
        <button className="button" onClick={() => void copy()}>
          <Copy size={15} />
          {copied}
        </button>
        <button className="button primary" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
