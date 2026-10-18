import type { NumberFilter } from '../../domain/types';

interface Props {
  label: string;
  value: NumberFilter;
  onChange: (value: NumberFilter) => void;
}

export function NumberRange({ label, value, onChange }: Props) {
  return (
    <fieldset className="[&+fieldset]:mt-3.75">
      <legend>{label}</legend>
      <div className="flex items-center gap-1.25 [&_input]:w-20 [&_input]:flex-1 max-[540px]:[&_input]:w-17.5 [&_select]:w-23.75 [&_select]:text-[11px] [&_span]:text-[11px] [&_span]:text-muted">
        <select
          aria-label={`${label}: condition`}
          value={value.operator}
          onChange={(event) =>
            onChange({
              ...value,
              operator: event.target.value as NumberFilter['operator'],
            })
          }
        >
          <option value="between">Between</option>
          <option value="gt">Greater than</option>
          <option value="lt">Less than</option>
        </select>
        <input
          aria-label={`${label}: ${value.operator === 'between' ? 'minimum' : 'value'}`}
          type="number"
          min="0"
          step="any"
          placeholder={value.operator === 'between' ? 'Minimum' : 'Value'}
          value={value.min}
          onChange={(event) => onChange({ ...value, min: event.target.value })}
        />
        {value.operator === 'between' && (
          <>
            <span>to</span>
            <input
              aria-label={`${label}: maximum`}
              type="number"
              min="0"
              step="any"
              placeholder="Maximum"
              value={value.max}
              onChange={(event) =>
                onChange({ ...value, max: event.target.value })
              }
            />
          </>
        )}
      </div>
    </fieldset>
  );
}
