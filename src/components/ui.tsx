import Link from "next/link";
import { Home } from "lucide-react";

export function Button({
  children,
  href,
  variant = "primary",
  type,
  onClick,
  disabled,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className">) {
  const variants: Record<string, string> = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm focus:ring-blue-500/20",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium focus:ring-slate-500/10",
    danger: "bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm focus:ring-red-500/20",
    ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-800 font-medium",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm focus:ring-emerald-500/20",
  };

  const cls = `inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  bodyClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className={`p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between pb-4 mb-4 border-b border-slate-100">
      <div>
        <h5 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h5>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Input({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  step,
  min,
}: {
  label?: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-xs font-semibold text-slate-700">{label}</span>}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        min={min}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

export function Select({
  label,
  name,
  required,
  defaultValue,
  children,
}: {
  label?: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <span className="text-xs font-semibold text-slate-700">{label}</span>}
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

export function Badge({
  color = "slate",
  children,
  className = "",
}: {
  color?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const colors: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color] ?? colors.slate} ${className}`}>
      {children}
    </span>
  );
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "slate",
    SENT: "blue",
    WAITING_DELIVERY: "amber",
    PARTIALLY_DELIVERED: "purple",
    WAITING_RECEIVING: "indigo",
    PARTIALLY_RECEIVED: "purple",
    RECEIVED: "green",
    CLOSED: "green",
    REVISED: "amber",
    CREATED: "slate",
    ARRIVED: "green",
    CANCELLED: "red",
    PENDING: "amber",
    VERIFIED: "blue",
  };
  return map[status] ?? "slate";
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-slate-400 font-medium">{message}</div>
  );
}

export function PageTitle({
  title,
  subtitle,
  breadcrumb = [],
  action,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2">
        <ol className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <li>
            <Home className="w-3.5 h-3.5 text-slate-400" />
          </li>
          {breadcrumb.map((b, i) => (
            <li key={b} className="flex items-center gap-1.5">
              <span>/</span>
              <span className={i === breadcrumb.length - 1 ? "text-slate-600 font-semibold" : ""}>{b}</span>
            </li>
          ))}
        </ol>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}

export function DataTable({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm text-slate-600 border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {head}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}
