import type { SelectHTMLAttributes } from 'react';

type SelectValue = string | number;
type SelectProps<T extends SelectValue> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'multiple' | 'size'
> & {
  value: T;
  options: readonly { value: NoInfer<T>; label: string; disabled?: boolean }[];
  onValueChange: (value: NoInfer<T>) => void;
  size?: 'default' | 'compact' | 'small';
};

const sizes = {
  default: 'min-h-8.75 py-1.5 text-[12px]',
  compact: 'min-h-7.5 py-1 text-[11px] max-[540px]:text-[10px]',
  small: 'min-h-6.5 py-0.5 text-[10px]',
};
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2373808e' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

/** Native keyboard and mobile selection, with shared spacing and typed values. */
export function Select<T extends SelectValue>({
  value,
  options,
  onValueChange,
  size = 'default',
  className = '',
  style,
  ...props
}: SelectProps<T>) {
  return (
    <select
      {...props}
      value={value}
      onChange={(event) => {
        const option = options.find(
          (item) => String(item.value) === event.currentTarget.value,
        );
        if (option && !option.disabled) onValueChange(option.value);
      }}
      className={`min-w-0 max-w-full appearance-none rounded-[7px] border border-border bg-white pr-9 pl-2.25 font-normal text-text hover:border-[#c9d7d3] disabled:cursor-default disabled:opacity-50 ${sizes[size]} ${className}`}
      style={{
        ...style,
        backgroundImage: chevron,
        backgroundPosition: 'right 5px center',
        backgroundSize: '14px 14px',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
