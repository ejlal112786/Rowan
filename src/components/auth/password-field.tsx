"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Password input with a visibility toggle.
 *
 * The toggle is a real control with a label that changes with its state
 * (`aria-pressed` plus a text alternative), because "show password" is an accessibility
 * feature as much as a convenience one: it lets someone check what they typed without
 * abandoning the form. It never changes the value's `autoComplete`, so password managers
 * keep working.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  hint,
  error,
  defaultValue,
  required = true,
  maxLength,
}: {
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  error?: string | undefined;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();

  return (
    <div className="relative">
      <FormField
        name={name}
        label={label}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        hint={hint}
        error={error}
        maxLength={maxLength}
        className="pr-0"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        id={toggleId}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => {
          setVisible((current) => !current);
        }}
        className={cn("text-muted-foreground absolute top-[1.7rem] right-1")}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
