import { Filter, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  options: FilterOption[];
  /** Empty set means "no filter" — every option counts, same as every option being checked. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  triggerLabel: string;
  allLabel: string;
  searchPlaceholder?: string;
}

/**
 * The "pick one, several, or all" column-header filter used across the
 * Staff Activity / Staff / Staff History tables — for the Staff(Name)
 * column it's a searchable staff picker, for the Reception/Floor
 * Task/Open-Pool/Break/Idle columns it's the same mechanism over a
 * fixed, short category list (search box only shown once there's
 * enough options for one to be worth it). Live-filtering, no
 * Apply/Cancel step — every checkbox change calls onChange immediately.
 */
export function FilterPopover({ options, selected, onChange, triggerLabel, allLabel, searchPlaceholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const isFiltered = selected.size > 0 && selected.size < options.length;
  const allSelected = selected.size === 0;
  const visibleOptions = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  function toggle(key: string) {
    const working = new Set(allSelected ? options.map((o) => o.key) : selected);
    if (working.has(key)) working.delete(key);
    else working.add(key);
    onChange(working.size === options.length ? new Set() : working);
  }

  return (
    <span className="filter-trigger-wrap" ref={containerRef}>
      <button
        type="button"
        className={`filter-trigger ${isFiltered ? 'filter-trigger-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <Filter size={12} />
      </button>
      {open && (
        <div className="filter-popover">
          {options.length > 6 && (
            <div className="filter-popover-search">
              <Search size={13} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
              />
            </div>
          )}
          <button type="button" className="filter-popover-all" onClick={() => onChange(new Set())}>
            {allLabel}
          </button>
          <div className="filter-popover-list">
            {visibleOptions.map((o) => (
              <label key={o.key} className="filter-popover-option">
                <input type="checkbox" checked={allSelected || selected.has(o.key)} onChange={() => toggle(o.key)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
