import { Search, ChevronDown } from "lucide-react";
import { WalletSearchResult } from "@/hooks/use-wallet-search";

interface WalletSelectDropdownProps {
  is_open: boolean;
  search_query: string;
  results: WalletSearchResult[];
  selected_value: string;
  on_search: (query: string) => void;
  on_select: (address: string) => void;
  on_toggle: () => void;
}

export function WalletSelectDropdown({
  is_open,
  search_query,
  results,
  selected_value,
  on_search,
  on_select,
  on_toggle,
}: WalletSelectDropdownProps) {
  const display_value = selected_value
    ? `${selected_value.slice(0, 8)}...${selected_value.slice(-8)}`
    : "Buscar usuario para transferir";

  const handle_select = (address: string) => {
    on_select(address);
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={on_toggle}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground flex items-center justify-between hover:border-primary transition-colors"
      >
        <span className="text-sm">{display_value}</span>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${
            is_open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {is_open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-input bg-card shadow-lg overflow-hidden">
          {/* Search Input - Row 1 */}
          <div className="p-3 border-b border-border bg-secondary/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search_query}
                onChange={(e) => on_search(e.target.value)}
                placeholder="Buscar usuario..."
                autoFocus
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Results List - Rows 2-6 (max 5 results con scroll) */}
          <div className="max-h-[calc(5*40px)] overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No se encontraron usuarios
              </div>
            ) : (
              results.map((result) => (
                <button
                  key={result.address}
                  type="button"
                  onClick={() => handle_select(result.address)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors border-b border-border last:border-b-0 active:bg-secondary/80"
                >
                  <div className="font-mono text-foreground">
                    {result.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.address}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop para cerrar dropdown */}
      {is_open && <div className="fixed inset-0 z-40" onClick={on_toggle} />}
    </div>
  );
}
