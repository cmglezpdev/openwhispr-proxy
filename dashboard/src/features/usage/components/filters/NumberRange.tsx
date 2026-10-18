import { Select } from '../../../../shared/ui/Select';
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
      <div className="flex items-center gap-1.25 [&_input]:w-20 [&_input]:flex-1 max-[540px]:[&_input]:w-17.5 [&_span]:text-[11px] [&_span]:text-muted">
        <Select
          className="w-30 shrink-0 text-[11px]"
          aria-label={`${label}: condition`}
          value={value.operator}
          onValueChange={(operator) =>
            onChange({
              ...value,
              operator,
            })
          }
          options={[
            { value: 'between', label: 'Between' },
            { value: 'gt', label: 'Greater than' },
            { value: 'lt', label: 'Less than' },
          ]}
        />
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
