import {
  BarChart3,
  Bell,
  CalendarDays,
  LogOut,
  Menu,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { useUnreadNotificationsCount } from "../hooks/useUnreadNotificationsCount";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { APP_VERSION } from "../lib/appVersion";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function profileInitials(displayName: string | null | undefined, email: string | null | undefined): string {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e?.includes("@")) return e.slice(0, 2).toUpperCase();
  return "?";
}

function MobileAccountDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const unreadCount = useUnreadNotificationsCount();

  if (!user) return null;

  const close = () => onOpenChange(false);
  const displayName =
    user.displayName?.trim() || user.email?.split("@")[0] || "Player";
  const email = user.email ?? "";

  const navBase =
    "flex items-center gap-3 rounded-xl px-4 py-3.5 text-[0.95rem] font-medium no-underline transition-colors hover:no-underline focus-visible:no-underline focus-visible:outline-none";
  // Global `a { color: #2563eb }` in index.css overrides Link text unless we use important utilities.
  const navIdle =
    "!text-slate-900 hover:!text-slate-900 visited:!text-slate-900 hover:bg-slate-100 active:bg-slate-100/80";
  const navActive =
    "bg-primary/12 font-semibold !text-primary ring-1 ring-primary/20 hover:!text-primary visited:!text-primary hover:bg-primary/15";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="account-menu-sheet"
        side="right"
        showCloseButton
        className={cn(
          "flex flex-col gap-0 overflow-y-auto rounded-none rounded-l-3xl border-l border-border bg-white p-0 shadow-2xl",
          "w-[min(85vw,320px)] max-w-none sm:max-w-none",
          "data-[side=right]:w-[min(85vw,320px)] data-[side=right]:max-w-none",
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Account menu</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-full flex-1 flex-col px-6 pb-8 pt-12">
          <div className="flex flex-col items-center border-b border-slate-200 pb-6">
            <div
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-100 text-xl font-semibold tracking-tight text-slate-600"
              aria-hidden
            >
              {profileInitials(user.displayName, user.email)}
            </div>
            <p className="mt-4 text-center text-base font-semibold text-slate-900">
              {displayName}
            </p>
            <p className="mt-1.5 max-w-full truncate text-center text-sm text-slate-500">
              {email}
            </p>
          </div>

          <nav className="flex flex-col gap-0.5 py-4" aria-label="Account">
            <Link
              to="/app/teams"
              className={cn(
                navBase,
                pathname.startsWith("/app/teams") ? navActive : navIdle,
              )}
              aria-current={pathname.startsWith("/app/teams") ? "page" : undefined}
              onClick={close}
            >
              <Users className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              My Team
            </Link>
            <Link
              to="/app/matches"
              className={cn(
                navBase,
                pathname.startsWith("/app/matches") ? navActive : navIdle,
              )}
              aria-current={pathname.startsWith("/app/matches") ? "page" : undefined}
              onClick={close}
            >
              <CalendarDays
                className="size-5 shrink-0 text-primary"
                strokeWidth={2.2}
                aria-hidden
              />
              My Matches
            </Link>
            <Link
              to="/app/tournaments"
              className={cn(
                navBase,
                pathname.startsWith("/app/tournaments") ? navActive : navIdle,
              )}
              aria-current={pathname.startsWith("/app/tournaments") ? "page" : undefined}
              onClick={close}
            >
              <Trophy className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              My Tournaments
            </Link>
            <Link
              to="/app/my-stats"
              className={cn(
                navBase,
                pathname.startsWith("/app/my-stats") ? navActive : navIdle,
              )}
              aria-current={pathname.startsWith("/app/my-stats") ? "page" : undefined}
              onClick={close}
            >
              <BarChart3 className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              My stats
            </Link>
            <Link
              to="/app/notifications"
              className={cn(
                navBase,
                pathname.startsWith("/app/notifications") ? navActive : navIdle,
              )}
              aria-current={pathname.startsWith("/app/notifications") ? "page" : undefined}
              onClick={close}
            >
              <Bell className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                Notifications
                {unreadCount > 0 ? (
                  <span className="flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </span>
            </Link>
          </nav>

          <Separator className="bg-slate-200" />

          <button
            type="button"
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[0.95rem] font-medium !text-primary transition-colors hover:!text-primary hover:bg-primary/5"
            onClick={async () => {
              try {
                await logout();
              } finally {
                close();
              }
            }}
          >
            <LogOut className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
            Logout
          </button>

          <p className="mt-auto pt-6 text-center text-xs text-slate-400">
            Version {APP_VERSION}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

function MobileBottomTabs({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[35] mx-auto grid h-[calc(64px+env(safe-area-inset-bottom))] w-full max-w-[768px] grid-cols-3 gap-1 border-t border-slate-200 bg-white px-2 pt-1.5 pb-0 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] [&_a]:!no-underline [&_a:hover]:!no-underline [&_a:focus]:!no-underline [&_a:active]:!no-underline"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.isActive(pathname);
        return (
          <NavLink
            key={item.label}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 flex-col items-center justify-center gap-1 rounded-[10px] border-b-[3px] border-b-transparent text-[0.8rem] font-semibold !no-underline decoration-transparent underline-offset-0 transition-colors hover:!no-underline focus:!no-underline focus-visible:!no-underline active:!no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
              active
                ? "border-b-primary text-primary"
                : "text-[#6b7280] hover:bg-slate-50 hover:text-[#374151]",
            )}
          >
            <Icon
              size={20}
              strokeWidth={2.3}
              aria-hidden
              className={cn(active ? "text-primary" : "text-[#6b7280]")}
            />
            <span
              className={cn(
                "!no-underline",
                active ? "text-primary" : "text-[#6b7280]",
              )}
            >
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function MenuUnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function MobileHeader() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useUnreadNotificationsCount();

  return (
    <header className="sticky top-0 z-30 w-full bg-transparent">
      <div className="grid h-[86px] w-full grid-cols-[58px_1fr_44px] items-center gap-3 bg-white px-6 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
        <Link
          to="/"
          className="inline-flex h-[58px] w-[58px] items-center justify-center rounded-[14px] bg-white"
          aria-label="ScoreTrack home"
        >
          <img
            src="/brand/scoretrack-icon.png"
            alt="ScoreTrack"
            className="h-[52px] w-[52px] rounded-[12px] object-cover"
          />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center justify-center"
          aria-label="ScoreTrack"
        >
          <img
            src="/brand/scoretrack-header-center.png"
            alt="ScoreTrack logo"
            className="h-[36px] w-auto max-w-[290px] object-contain"
          />
        </Link>
        {user ? (
          <>
            <button
              type="button"
              aria-label={
                unreadCount > 0
                  ? `Open menu, ${unreadCount} unread notifications`
                  : "Open menu"
              }
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "account-menu-sheet" : undefined}
              onClick={() => setMenuOpen(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            >
              <Menu size={36} strokeWidth={2.4} />
              <MenuUnreadBadge count={unreadCount} />
            </button>
            <MobileAccountDrawer open={menuOpen} onOpenChange={setMenuOpen} />
          </>
        ) : (
          <div className="h-11 w-11" aria-hidden />
        )}
      </div>
      <div className="h-[3px] w-full bg-primary/95" />
    </header>
  );
}

export function PublicMobileFooter() {
  const { user } = useAuth();
  const items: NavItem[] = [
    {
      to: "/",
      label: "Matches",
      icon: CalendarDays,
      isActive: (pathname) =>
        pathname === "/" ||
        pathname === "/matches" ||
        pathname.startsWith("/live/") ||
        pathname.startsWith("/player/"),
    },
    {
      to: "/tournaments",
      label: "Tournaments",
      icon: Trophy,
      isActive: (pathname) => pathname.startsWith("/tournaments"),
    },
    {
      to: user ? "/app/profile" : "/login",
      label: "Profile",
      icon: User,
      isActive: (pathname) =>
        pathname === "/login" ||
        pathname === "/register" ||
        pathname.startsWith("/app/profile") ||
        pathname === "/app/my-stats",
    },
  ];
  return <MobileBottomTabs items={items} />;
}
