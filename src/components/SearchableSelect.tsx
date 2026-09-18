"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;        // for hidden input (form submission)
  className?: string;
  triggerClassName?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "-- Pilih Opsi --",
  disabled = false,
  required = false,
  name,
  className = "",
  triggerClassName = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  // Filter options based on active search text
  const filtered = isTyping && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Keep highlightedIndex in bounds when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered.length]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsTyping(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  function handleSelect(optValue: string) {
    onChange(optValue);
    setOpen(false);
    setIsTyping(false);
    setSearch("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearch("");
    setIsTyping(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setIsTyping(false);
      setSearch("");
    }
  }

  const displayValue = isTyping ? search : (selected ? selected.label : "");

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input for native form submission */}
      {name && <input type="hidden" name={name} value={value} required={required} />}

      {/* Main Single Combobox Input */}
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`
          w-full flex items-center justify-between gap-2
          px-3.5 py-2.5 text-sm
          border rounded-xl bg-white
          cursor-text transition-all duration-150
          ${disabled
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : open
            ? "border-blue-500 ring-2 ring-blue-500/15 shadow-xs"
            : "border-slate-200 hover:border-slate-300 shadow-xs"
          }
          ${triggerClassName}
        `}
      >
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsTyping(true);
            if (!open) setOpen(true);
          }}
          onFocus={(e) => {
            if (!disabled) {
              setOpen(true);
              // Select all on focus for easy replacement
              e.target.select();
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full bg-transparent text-sm outline-none text-slate-800 placeholder:text-slate-400 truncate cursor-text"
        />

        <div className="flex items-center gap-1 shrink-0">
          {(value || search) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Hapus pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                if (open) {
                  setOpen(false);
                  setIsTyping(false);
                } else {
                  setOpen(true);
                  inputRef.current?.focus();
                }
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180 text-blue-500" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Pure Dropdown List (No Nested Search Box!) */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-98 duration-100">
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-400 text-center">
                Tidak ada hasil yang cocok dengan &ldquo;{search}&rdquo;
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <li
                    key={opt.value}
                    onMouseDown={(e) => {
                      // use onMouseDown to trigger before blur
                      e.preventDefault();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`
                      px-3.5 py-2 text-xs cursor-pointer flex items-center justify-between gap-2
                      transition-colors
                      ${isHighlighted ? "bg-slate-100/80 text-slate-900" : "text-slate-700"}
                      ${isSelected ? "font-bold text-blue-600 bg-blue-50/50" : ""}
                    `}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <span className="text-blue-600 font-bold shrink-0">✓</span>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {options.length > 5 && (
            <div className="px-3.5 py-1.5 border-t border-slate-100 text-[10px] text-slate-400 font-medium bg-slate-50/50">
              {filtered.length} dari {options.length} opsi tersedia
            </div>
          )}
        </div>
      )}
    </div>
  );
}
