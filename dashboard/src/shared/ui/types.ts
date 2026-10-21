import type { ButtonHTMLAttributes, SelectHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'text';
};

export type SelectValue = string | number;

export interface SelectOption<T extends SelectValue> {
  value: T;
  label: string;
  disabled?: boolean;
}

export type SelectProps<T extends SelectValue> = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'multiple' | 'size'
> & {
  value: T;
  options: readonly SelectOption<NoInfer<T>>[];
  onValueChange: (value: NoInfer<T>) => void;
  size?: 'default' | 'compact' | 'small';
};
