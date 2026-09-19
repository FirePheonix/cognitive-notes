import { PanelRight } from "lucide-react";
import LogoIcon from "@/assets/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  onOpenSearch: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  breadcrumb: string[] | null;
}

export function Navbar({
  onOpenSearch,
  outlineOpen,
  onToggleOutline,
  breadcrumb,
}: NavbarProps) {
  return (
    <header className="sticky top-0 isolate z-[200] border-b border-neutral-200 bg-background/95 dark:border-[#222] dark:bg-[#050608]/95">
      <div className="w-full px-4 md:px-6">
        <div className="flex items-center justify-between py-2.5">
          {/* Left: logo + breadcrumb */}
          <div className="flex min-w-0 items-center gap-3">
            <LogoIcon className="w-5 shrink-0 rotate-180 text-foreground" />
            <span
              className="shrink-0 text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              Vengeance
            </span>

            {breadcrumb && breadcrumb.length > 0 ? (
              <>
                <span className="text-neutral-300 dark:text-zinc-600">/</span>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {breadcrumb.map((segment, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span className="text-neutral-300 dark:text-zinc-600">
                          /
                        </span>
                      )}
                      <span
                        className={cn(
                          "truncate",
                          i === breadcrumb.length - 1
                            ? "font-medium text-foreground"
                            : "",
                        )}
                      >
                        {segment}
                      </span>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Right: search + outline + theme */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex h-8 w-[200px] items-center justify-between rounded-md border border-foreground/10 bg-foreground/[0.035] px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/15 hover:bg-foreground/[0.055] hover:text-foreground lg:w-[260px]"
            >
              <span className="flex items-center gap-2 truncate">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4 shrink-0 opacity-65"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="truncate">Search files...</span>
              </span>
              <kbd className="ml-2 rounded border border-foreground/10 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
                Ctrl K
              </kbd>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleOutline}
              aria-label="Toggle outline"
              className={cn(
                "size-8 rounded-full border border-neutral-300/80 bg-background shadow-sm dark:border-zinc-700 dark:bg-zinc-950",
                outlineOpen
                  ? "text-foreground"
                  : "text-neutral-500 dark:text-zinc-400",
              )}
            >
              <PanelRight className="h-[18px] w-[18px]" strokeWidth={2} />
            </Button>

            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
