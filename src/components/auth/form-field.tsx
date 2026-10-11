"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Labelled text input with hint and error wiring.
 *
 * Accessibility is part of the component rather than the call site: the label is always
 * associated with the input, errors are announced (`role="alert"`) *and* referenced
 * through `aria-describedby`, and `aria-invalid` marks the field for assistive
 * technology and for the error styling.
 */

export type FormFieldProps = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "url" | undefined;
  autoComplete?: string | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
  /** Guidance shown under the field; also the accessible description. */
  hint?: string | undefined;
  /** Field-level error from the server action. */
  error?: string | undefined;
  maxLength?: number | undefined;
  className?: string | undefined;
};

export function FormField({
  name,
  label,
  type = "text",
  autoComplete,
  required = false,
  disabled = false,
  defaultValue,
  placeholder,
  hint,
  error,
  maxLength,
  className,
}: FormFieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId]
    .filter((value): value is string => value !== null)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>

      <input
        id={inputId}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        className={cn(
          "border-input bg-background h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error !== undefined && "border-destructive focus-visible:ring-destructive",
        )}
      />

      {hint === undefined ? null : (
        <p id={hintId} className="text-muted-foreground text-xs leading-relaxed">
          {hint}
        </p>
      )}

      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-destructive text-xs leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
