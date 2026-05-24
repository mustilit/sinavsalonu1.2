import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * TopicCombobox — soru oluşturma akışında konu seçimi için arama destekli combobox.
 *
 * Topic listesi düz olarak gelir ama her satırın `path: string[]` veya `fullPath: string`
 * alanı bulunur (örn. "Matematik › Sayılar › Gerçek Sayılar"). Arama hem konu adı
 * hem ağaçtaki yol üzerinde çalışır — kullanıcı "Gerçek" yazınca "Matematik › ...
 * Gerçek Sayılar" eşleşir.
 *
 * @param {object} props
 * @param {string | null} props.value         - Seçili topic id'si veya null/undefined
 * @param {(id: string | null) => void} props.onChange
 * @param {Array<{id: string, name: string, path?: string[], fullPath?: string, parentName?: string}>} props.topics
 * @param {string} [props.placeholder="— Seçilmedi —"]
 * @param {string} [props.emptyLabel="— Seçilmedi —"]
 * @param {string} [props.searchPlaceholder="Konu ara..."]
 * @param {string} [props.emptyText="Konu bulunamadı"]
 * @param {string} [props.className]
 * @param {boolean} [props.disabled]
 */
export function TopicCombobox({
  value,
  onChange,
  topics,
  placeholder = "— Seçilmedi —",
  emptyLabel = "— Seçilmedi —",
  searchPlaceholder = "Konu ara...",
  emptyText = "Konu bulunamadı",
  className,
  disabled,
}) {
  const [open, setOpen] = React.useState(false);

  // Her topic için arama metni: tam yol + isim (kullanıcı parent ya da leaf yazabilir)
  const searchText = React.useCallback((t) => {
    const path = Array.isArray(t.path) ? t.path : (t.fullPath ? t.fullPath.split(' › ') : []);
    const trail = path.length ? path.join(' ') : (t.parentName ? `${t.parentName} ${t.name}` : t.name);
    return `${trail} ${t.name}`.toLowerCase();
  }, []);

  const selectedTopic = value ? topics.find((t) => t.id === value) : null;
  const selectedLabel = selectedTopic
    ? (selectedTopic.fullPath
        || (Array.isArray(selectedTopic.path) && selectedTopic.path.join(' › '))
        || (selectedTopic.parentName ? `${selectedTopic.parentName} › ${selectedTopic.name}` : selectedTopic.name))
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full h-9 justify-between font-normal px-3 bg-transparent",
            !selectedTopic && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">{selectedLabel ?? placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {selectedTopic && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                aria-label="Temizle"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden="true" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[320px]"
      >
        <Command
          filter={(itemValue, search) => {
            if (itemValue === '__NONE__') {
              return emptyLabel.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }
            const t = topics.find((x) => x.id === itemValue);
            if (!t) return 0;
            return searchText(t).includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="__NONE__"
                value="__NONE__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", !selectedTopic ? "opacity-100" : "opacity-0")}
                />
                <span className="text-muted-foreground">{emptyLabel}</span>
              </CommandItem>
              {topics.map((t) => {
                const path = Array.isArray(t.path)
                  ? t.path
                  : (t.fullPath ? t.fullPath.split(' › ') : (t.parentName ? [t.parentName, t.name] : [t.name]));
                const isLeafOnly = path.length === 1;
                const parents = path.slice(0, -1);
                const leaf = path[path.length - 1] ?? t.name;
                return (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    onSelect={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                    className="items-start"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 mt-0.5 shrink-0",
                        value === t.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col min-w-0">
                      {!isLeafOnly && (
                        <span className="text-xs text-muted-foreground truncate">
                          {parents.join(' › ')}
                        </span>
                      )}
                      <span className="truncate">{leaf}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default TopicCombobox;
