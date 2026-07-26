import { Send, ArrowRight } from "lucide-react";

interface SubmitButtonProps {
  is_disabled: boolean;
  is_loading: boolean;
  onClick?: () => void;
}

export function SubmitButton({ is_disabled, is_loading }: SubmitButtonProps) {
  const button_text = is_loading ? "Procesando..." : "Confirmar Transferencia";
  const button_classes = `w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2`;

  return (
    <button
      type="submit"
      disabled={is_disabled || is_loading}
      className={button_classes}
    >
      {is_loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          {button_text}
        </>
      ) : (
        <>
          <Send className="h-5 w-5" />
          {button_text}
          <ArrowRight className="h-5 w-5" />
        </>
      )}
    </button>
  );
}
