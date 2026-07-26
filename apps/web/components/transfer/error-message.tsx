import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-destructive/20 bg-destructive/10 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-destructive/20 p-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-destructive">Error</h3>
          <p className="mt-1 text-sm text-destructive/80">{message}</p>
        </div>
      </div>
    </div>
  );
}
