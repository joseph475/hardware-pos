"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  SlidersHorizontal,
  ArrowLeftRight,
  Truck,
  ClipboardList,
  TrendingUp,
  Building2,
  Users,
  Tag,
  ChevronDown,
  Store,
  Settings2,
  History,
  FileBarChart2,
  Users2,
  PackageSearch,
  Layers,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useUserProfile } from "@/lib/context/user-profile";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  mainBranchOrOwnerOnly?: boolean;
};

type NavSection = {
  label: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  items: NavItem[];
  roles?: string[];
};

type NavEntry =
  | ({ type: "link" } & NavItem)
  | ({ type: "section" } & NavSection);

const NAV_ENTRIES: NavEntry[] = [
  {
    type: "link",
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "manager"],
  },
  {
    type: "link",
    label: "POS",
    href: "/pos",
    icon: ShoppingCart,
    roles: ["manager", "cashier"],
  },
  {
    type: "link",
    label: "Customers",
    href: "/customers",
    icon: Users2,
    roles: ["owner", "manager", "cashier"],
  },
  {
    type: "link",
    label: "Quotations",
    href: "/quotations",
    icon: ClipboardList,
    roles: ["manager", "cashier"],
  },
  {
    type: "link",
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
    roles: ["owner", "manager", "cashier"],
  },
  {
    type: "section",
    label: "Inventory",
    icon: Package,
    defaultOpen: false,
    roles: ["owner", "manager", "cashier"],
    items: [
      { label: "Products", href: "/inventory/products", icon: Package },
      { label: "Bundles", href: "/inventory/bundles", icon: Layers, roles: ["owner", "manager"] },
      { label: "Stock Levels", href: "/inventory/stock", icon: BarChart3 },
      {
        label: "Adjustments",
        href: "/inventory/adjustments",
        icon: SlidersHorizontal,
      },
      {
        label: "Transfers",
        href: "/inventory/transfers",
        icon: ArrowLeftRight,
        roles: ["owner", "manager"],
        mainBranchOrOwnerOnly: true,
      },
      {
        label: "Cross-Branch Stock",
        href: "/inventory/cross-branch",
        icon: BarChart3,
        roles: ["owner", "manager"],
        mainBranchOrOwnerOnly: true,
      },
    ],
  },
  {
    type: "section",
    label: "Purchasing",
    icon: Truck,
    defaultOpen: false,
    roles: ["owner", "manager"],
    items: [
      { label: "Suppliers", href: "/purchasing/suppliers", icon: Truck, mainBranchOrOwnerOnly: true },
      {
        label: "Purchase Orders",
        href: "/purchasing/orders",
        icon: ClipboardList,
        mainBranchOrOwnerOnly: true,
      },
      {
        label: "Branch Requests",
        href: "/purchasing/branch-requests",
        icon: ClipboardList,
      },
    ],
  },
  {
    type: "section",
    label: "Reports",
    icon: TrendingUp,
    defaultOpen: false,
    roles: ["owner", "manager"],
    items: [
      { label: "Products", href: "/reports/products", icon: PackageSearch },
      { label: "Suppliers", href: "/reports/suppliers", icon: Truck },
      { label: "Transaction History", href: "/reports/transactions", icon: History },
      { label: "Sales Reading", href: "/reports/z-report", icon: FileBarChart2 },
    ],
  },
  {
    type: "section",
    label: "Settings",
    icon: SlidersHorizontal,
    defaultOpen: false,
    roles: ["owner", "manager"],
    items: [
      { label: "Organization", href: "/settings/organization", icon: Settings2, roles: ["owner"] },
      { label: "Branches", href: "/settings/branches", icon: Building2, roles: ["owner"] },
      { label: "Users", href: "/settings/users", icon: Users, roles: ["owner"] },
      { label: "Categories", href: "/settings/categories", icon: Tag, roles: ["owner", "manager"] },
    ],
  },
];

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
  indent = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        indent && "ml-2 pl-6",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function CollapsibleSection({
  section,
  pathname,
  role,
  isMainBranch,
}: {
  section: NavSection;
  pathname: string;
  role: string | null;
  isMainBranch: boolean;
}) {
  const visibleItems = section.items.filter((item) => {
    if (item.roles && !(role && item.roles.includes(role))) return false;
    if (item.mainBranchOrOwnerOnly && !isMainBranch && role !== "owner") return false;
    return true;
  });
  const isAnyChildActive = visibleItems.some((item) =>
    pathname.startsWith(item.href)
  );

  const [open, setOpen] = React.useState(
    section.defaultOpen ?? isAnyChildActive
  );

  // Auto-open if a child becomes active (e.g. on direct navigation)
  React.useEffect(() => {
    if (isAnyChildActive) setOpen(true);
  }, [isAnyChildActive]);

  const SectionIcon = section.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isAnyChildActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <SectionIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-none">
        <div className="mt-0.5 flex flex-col gap-0.5 pb-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname.startsWith(item.href)}
              indent
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface SidebarNavProps {
  className?: string;
  onNavigate?: () => void;
}

export function SidebarNav({ className, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { profile, branch } = useUserProfile();

  const role = profile?.role ?? null;
  const isMainBranch = (branch as any)?.is_main === true;

  // Sections hidden from cashiers
  const CASHIER_HIDDEN_SECTIONS = ["Settings", "Purchasing", "Sales"];

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4 pl-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary">
          <Store className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-sidebar-foreground">
            BranchPOS
          </span>
          <span className="text-[10px] text-sidebar-foreground/50 tracking-wide uppercase">
            Management
          </span>
        </div>
      </div>

      {/* Branch badge */}
      <div className="border-b border-sidebar-border px-3 py-3">
        {role === "owner" ? (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            <span className="flex-1 text-left text-sidebar-foreground/80 text-sm font-medium truncate">
              All Branches
            </span>
          </div>
        ) : profile?.branch_id && branch ? (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            <span className="flex-1 text-left text-sidebar-foreground/80 text-sm font-medium truncate">
              {branch.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
            <Building2 className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1 text-left text-amber-500 text-xs font-medium">
              No branch assigned
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3">
        <nav
          className="flex flex-col gap-0.5"
          onClick={onNavigate}
          role="navigation"
          aria-label="Main navigation"
        >
          {NAV_ENTRIES.map((entry) => {
            // Role-based visibility: hide certain sections from cashiers
            if (
              entry.type === "section" &&
              role === "cashier" &&
              CASHIER_HIDDEN_SECTIONS.includes(entry.label)
            ) {
              return null;
            }
            // Hide sections restricted by role
            if (
              entry.type === "section" &&
              entry.roles &&
              role &&
              !entry.roles.includes(role)
            ) {
              return null;
            }
            if (entry.type === "link") {
              // Hide links restricted by role
              if (entry.roles && role && !entry.roles.includes(role)) {
                return null;
              }
              return (
                <NavLink
                  key={entry.href}
                  href={entry.href}
                  icon={entry.icon}
                  label={entry.label}
                  isActive={
                    entry.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(entry.href)
                  }
                />
              );
            }

            return (
              <CollapsibleSection
                key={entry.label}
                section={entry}
                pathname={pathname}
                role={role}
                isMainBranch={isMainBranch}
              />
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-sidebar-border px-3 py-3">
        <Separator className="mb-3 opacity-0" />
        <p className="px-2 text-[10px] text-sidebar-foreground/30 tracking-wider uppercase">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
