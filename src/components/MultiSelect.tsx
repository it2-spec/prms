"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export type MultiSelectOption = {
  value: string;
  label: string;
};

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
}

export default function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "Pilih departemen...",
  searchPlaceholder = "Cari departemen...",
  disabled = false,
  name,
  className = "",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const removeOption = (val: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(values.filter((v) => v !== val));
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative select-none text-xs ${className}`}>
      {/* Hidden inputs for form submit if name provided */}
      {name && (
        <input type="hidden" name={name} value={values.join(", ")} />
      )}

      {/* Main trigger container */}
      <div
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`min-h-[34px] w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-800 transition flex flex-wrap items-center gap-1.5 cursor-pointer ${
          open ? "ring-2 ring-blue-500 border-blue-500" : "hover:border-slate-400"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
      >
        {/* Selected badge tags */}
        {values.map((val) => {
          const opt = options.find((o) => o.value === val);
          const label = opt?.label || val;
          return (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-semibold border border-blue-200"
            >
              <span>{label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeOption(val, e)}
                  className="text-blue-600 hover:text-blue-900 focus:outline-none p-0.5 rounded-full hover:bg-blue-200/60"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}

        {/* Search input inline */}
        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-[100px] border-none bg-transparent p-0.5 text-xs text-slate-800 outline-none focus:ring-0 placeholder:text-slate-400"
            placeholder={values.length === 0 ? placeholder : searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !search && values.length > 0) {
                removeOption(values[values.length - 1]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
        ) : values.length === 0 ? (
          <span className="text-slate-400 text-xs py-0.5">{placeholder}</span>
        ) : null}

        {/* Right indicator icons */}
        <div className="ml-auto flex items-center gap-1 pl-1 text-slate-400">
          {values.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-0.5 hover:text-slate-700"
              title="Hapus semua"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              open ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="p-2 text-center text-slate-400 text-xs italic">
              Tidak ada departemen yang cocok
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = values.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(opt.value);
                    inputRef.current?.focus();
                  }}
                  className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-50 text-blue-800 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
