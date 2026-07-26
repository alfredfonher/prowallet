import { CheckCircle2 } from "lucide-react";
import { formatNumber } from "@/lib/token-store";

interface SuccessMessageProps {
  from: string;
  to: string;
  amount: number;
  tx_id: string;
}

export function SuccessMessage({
  from,
  to,
  amount,
  tx_id,
}: SuccessMessageProps) {
  const short_to = `${to.slice(0, 8)}...${to.slice(-8)}`;

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-success/20 bg-success/10 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-success/20 p-2">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <div>
          <h3 className="font-semibold text-success">
            ¡Transferencia Exitosa!
          </h3>
          <p className="mt-1 text-sm text-success/80">
            Se transfirieron{" "}
            <span className="font-semibold">{formatNumber(amount)} GAPC</span>{" "}
            de {from} a {short_to}
          </p>
          <p className="mt-1 text-sm text-success/60">TX ID: {tx_id}</p>
        </div>
      </div>
    </div>
  );
}
