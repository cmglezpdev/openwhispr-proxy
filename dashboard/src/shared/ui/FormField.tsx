import type { LabelHTMLAttributes } from 'react';

export function FormField({
  className = '',
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={`flex flex-col gap-1.5 text-[11px] font-[550] text-[#607080] [&_input]:w-full [&_input]:text-[12px] [&_input]:font-normal [&_input]:text-text [&_select]:w-full [&_select]:text-[12px] [&_select]:font-normal [&_select]:text-text ${className}`}
    />
  );
}
