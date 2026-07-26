import { TransferFormData } from "@/hooks/use-transfer-form";

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}

export function FormField({
  label,
  value,
  onChange,
  placeholder = "",
  required = false,
  type = "text",
  min,
  step,
}: FormFieldProps) {
  const handle_change = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => onChange(e.target.value);

  const input_props = {
    value,
    onChange: handle_change,
    placeholder,
    required,
    className:
      "w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </label>
      {type === "select" ? (
        <select {...input_props} />
      ) : (
        <input {...input_props} type={type} min={min} step={step} />
      )}
    </div>
  );
}
