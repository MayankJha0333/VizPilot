"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronsLeft, ChevronsRight, Database, LayoutGrid, LogOut, Menu as MenuIcon, Plus, Search, Settings, Sparkles, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogoMark, Tooltip, Wordmark } from "@/components/ui/misc";
import { Menu } from "@/components/ui/Menu";
import { CommandPalette } from "@/components/layout/CommandPalette";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, match: ["/dashboard", "/reports"] },
  { href: "/datasets", label: "Datasets", icon: Database, match: ["/datasets"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

export function AppShell({ children, wide = false, title }: { children: React.ReactNode; wide?: boolean; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("vp.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [palette, setPalette] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("vp.sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !pathname.startsWith("/reports/")) {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  const name = profile?.name || user?.displayName || user?.email?.split("@")[0] || "You";
  const email = profile?.email || user?.email || "";
  const initial = name.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const navLink = (item: (typeof NAV)[number], compact: boolean) => {
    const active = item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
    const Icon = item.icon;
    const el = (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold transition-[background,color,box-shadow] duration-200",
          compact && "justify-center px-0",
          active ? "clay-inset text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
        )}
      >
        <Icon className={clsx("h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110", active ? "text-brand" : "text-ink-3 group-hover:text-ink")} />
        {!compact && <span>{item.label}</span>}
      </Link>
    );
    return compact ? (
      <Tooltip key={item.href} label={item.label}>
        {el}
      </Tooltip>
    ) : (
      <div key={item.href}>{el}</div>
    );
  };

  const renderSidebar = (compact: boolean) => (
    <div className="clay flex h-full flex-col overflow-y-auto rounded-[28px] text-ink-2 scrollbar-thin">
      <div className={clsx("flex h-16 items-center", compact ? "justify-center" : "justify-between px-4")}>
        <Link href="/dashboard" aria-label="VizPilot home" className="transition-transform duration-200 hover:scale-[1.03]">
          {compact ? <LogoMark size={32} /> : <Wordmark />}
        </Link>
        <button className="clay-sm clay-press rounded-xl p-1.5 text-ink-3 hover:text-ink lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className={clsx("px-3", compact && "flex justify-center")}>
        {compact ? (
          <Tooltip label="New report">
            <Link href="/reports/new" className="clay-tile clay-press h-11 w-11 rounded-[16px] bg-clay-lavender text-clay-lavender-ink transition-transform hover:-translate-y-0.5" aria-label="New report">
              <Plus className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : (
          <Link href="/reports/new" className="clay-tile clay-press flex w-full gap-2 rounded-[16px] bg-clay-lavender py-3 text-sm font-extrabold text-clay-lavender-ink transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" /> New report
          </Link>
        )}
      </div>

      {!compact && (
        <button onClick={() => setPalette(true)} className="clay-inset mx-3 mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-3 transition-colors hover:text-ink" data-testid="open-palette">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search…</span>
          <span className="kbd">⌘K</span>
        </button>
      )}

      <nav className={clsx("mt-4 flex flex-col gap-1 px-3", compact && "items-center")}>
        {!compact && <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Workspace</div>}
        {NAV.map((item) => navLink(item, compact))}
      </nav>

      {!compact && (
        <div className="clay-tile mx-3 mt-6 block rounded-[20px] bg-clay-lavender p-3.5 text-left">
          <div className="flex items-center gap-2 text-xs font-extrabold text-clay-lavender-ink">
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-clay-lavender-ink">Open any report and ask in plain English — “revenue by region, top 5”.</p>
        </div>
      )}

      <div className={clsx("mt-auto flex flex-col gap-1 px-3 pb-3", compact && "items-center")}>
        <button onClick={toggleCollapsed} className={clsx("hidden items-center gap-3 rounded-2xl px-3 py-2 text-xs font-bold text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink lg:flex", compact && "justify-center px-0")} aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}>
          {compact ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!compact && "Collapse"}
        </button>
        <Menu
          align="left"
          side="top"
          className={clsx(!compact && "w-full")}
          trigger={
            <button className={clsx("flex w-full items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-2", compact && "justify-center px-0")} aria-label="Account menu">
              <Avatar initial={initial} photo={profile?.photoURL || user?.photoURL || ""} />
              {!compact && (
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px] font-extrabold text-ink">{name}</div>
                  <div className="truncate text-[11px] font-semibold text-ink-3">{email}</div>
                </div>
              )}
            </button>
          }
          items={[
            { label: "Settings", icon: <Settings className="h-4 w-4" />, onClick: () => router.push("/settings") },
            { label: "Sign out", icon: <LogOut className="h-4 w-4" />, onClick: handleSignOut, danger: true },
          ]}
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className={clsx("hidden shrink-0 transition-[width] duration-300 lg:block", collapsed ? "w-[92px]" : "w-[264px]")}>
        <div className="sticky top-0 h-screen p-3 pr-1">
          {renderSidebar(collapsed)}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-[#262b58]/35 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 p-3 animate-slide-in-left">
            {renderSidebar(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:hidden">
          <button className="clay-sm clay-press rounded-xl p-1.5 text-ink-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon className="h-5 w-5" />
          </button>
          <Wordmark size={26} />
          <span className="ml-auto flex items-center gap-1">
            <button onClick={() => setPalette(true)} className="clay-sm clay-press rounded-xl p-2 text-ink-2" aria-label="Search">
              <Search className="h-4 w-4" />
            </button>
            <Link href="/reports/new" className="clay-brand clay-press rounded-xl p-2" aria-label="New report">
              <Plus className="h-4 w-4" />
            </Link>
          </span>
        </header>

        {title && <div className="sr-only">{title}</div>}
        <main className={clsx("mx-auto w-full flex-1", wide ? "max-w-none" : "max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8")}>{children}</main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

export function Avatar({ initial, photo, size = 32 }: { initial: string; photo?: string; size?: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-2 ring-surface shadow-[var(--shadow-sm)]" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand via-brand-2 to-brand-3 text-xs font-extrabold text-white ring-2 ring-surface shadow-[var(--shadow-sm)]" style={{ width: size, height: size }}>
      {initial}
    </span>
  );
}
