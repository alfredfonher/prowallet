import { Send } from "lucide-react";

export function TransferHeader() {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="rounded-xl bg-blue-100 p-3">
        <Send className="h-6 w-6 text-blue-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Transferir Tokens
        </h2>
        <p className="text-sm text-muted-foreground">
          Mueve tokens entre holders o direcciones externas
        </p>
      </div>
    </div>
  );
}
