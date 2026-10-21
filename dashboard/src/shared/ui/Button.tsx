import type { ButtonHTMLAttributes } from 'react';

import type { ButtonProps } from './types';

const variants = {
  default: 'border-border bg-white hover:border-[#c9d7d3] hover:bg-[#f8fafb]',
  primary: 'border-teal bg-teal text-white hover:bg-teal',
  text: 'border-0 bg-transparent p-1 text-[11px] text-muted shadow-none hover:text-teal',
};

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`${variant === 'text' ? 'flex items-center gap-1.5' : 'inline-flex items-center justify-center gap-1.75 rounded-[7px] border px-3 py-2 text-[12px] font-[550] whitespace-nowrap shadow-card'} ${variants[variant]} ${className}`}
    />
  );
}

export function IconButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex size-7.5 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted enabled:hover:bg-teal-light enabled:hover:text-teal ${className}`}
    />
  );
}
