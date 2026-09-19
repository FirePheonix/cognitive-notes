import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, X, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface OutlineHeading {
  id: string;
  title: string;
  depth: number;
}

/* ── SVG path builder (ported from the web version's TOC) ── */

const railOffset = 8;
const rowHeight = 36;
const rowInset = 6;
const getLineOffset = (depth: number) =>
  depth <= 2 ? railOffset : railOffset * 2;
const getItemOffset = (depth: number) => (depth <= 2 ? 20 : 32);

interface ComputedSVG {
  width: number;
  height: number;
  d: string;
  positions: [top: number, bottom: number, x: number][];
}

function buildPath(items: OutlineHeading[]): ComputedSVG {
  let width = 0;
  let d = "";
  const positions: [number, number, number][] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const x = getLineOffset(item.depth) + 0.5;
    const top = i * rowHeight + rowInset;
    const bottom = (i + 1) * rowHeight - rowInset;

    width = Math.max(x + 8, width);

    if (i === 0) {
      d += ` M${x} ${top} L${x} ${bottom}`;
    } else {
      const [, upperBottom, upperX] = positions[i - 1];
      d += ` C ${upperX} ${top - 4} ${x} ${upperBottom + 4} ${x} ${top} L${x} ${bottom}`;
    }

    positions.push([top, bottom, x]);
  }

  return { d, height: items.length * rowHeight, positions, width };
}

/* ── Component ── */

interface RightSidebarProps {
  open: boolean;
  onClose: () => void;
  headings: OutlineHeading[];
  fileName: string;
  wordCount: number;
  readingTime: string;
  updatedAt: number;
}

export function RightSidebar({
  open,
  onClose,
  headings,
  fileName,
  wordCount,
  readingTime,
  updatedAt,
}: RightSidebarProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastIndexRef = useRef(0);

  const computed = useMemo(() => buildPath(headings), [headings]);

  /* scroll-spy: find the active heading */
  const handleScroll = useCallback(() => {
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;

    const headingEls = editorEl.querySelectorAll("h1, h2, h3");
    let currentIndex = 0;

    for (let i = headingEls.length - 1; i >= 0; i--) {
      const rect = headingEls[i].getBoundingClientRect();
      if (rect.top <= 120) {
        currentIndex = i;
        break;
      }
    }

    if (lastIndexRef.current !== currentIndex) {
      lastIndexRef.current = currentIndex;
      setActiveIndex(currentIndex);
    }
  }, []);

  useEffect(() => {
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      rafRef.current = requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
    };

    editorEl.addEventListener("scroll", onScroll, { passive: true });
    rafRef.current = requestAnimationFrame(handleScroll);

    return () => {
      editorEl.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll, headings]);

  const handleClick = useCallback((index: number) => {
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;
    const headingEls = editorEl.querySelectorAll("h1, h2, h3");
    headingEls[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const formattedDate = useMemo(() => {
    if (!updatedAt) return "";
    const d = new Date(updatedAt);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [updatedAt]);

  /* active highlight positions */
  const activePos = computed.positions[activeIndex];

  return (
    <aside
      className={cn(
        "shrink-0 border-l border-neutral-200 bg-background transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-zinc-800",
        open
          ? "w-[220px] opacity-100 xl:w-[240px]"
          : "w-0 overflow-hidden opacity-0",
      )}
    >
      <div className="flex h-full w-[220px] flex-col xl:w-[240px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlignLeft className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Outline
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close outline"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* TOC items */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {headings.length > 0 ? (
            <div className="relative ml-1">
              {/* SVG rail */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute left-0 top-0"
                viewBox={`0 0 ${computed.width} ${computed.height}`}
                style={{ height: computed.height, width: computed.width }}
              >
                <path
                  d={computed.d}
                  className="stroke-border/60 dark:stroke-border/40"
                  fill="none"
                  strokeLinecap="butt"
                  strokeWidth="1"
                />
                {/* Active highlight */}
                {activePos ? (
                  <path
                    d={computed.d}
                    className="stroke-primary"
                    fill="none"
                    strokeLinecap="butt"
                    strokeWidth="1.25"
                    style={{
                      clipPath: `polygon(0 ${activePos[0]}px, 100% ${activePos[0]}px, 100% ${activePos[1]}px, 0 ${activePos[1]}px)`,
                    }}
                  />
                ) : null}
              </svg>

              {/* Items */}
              <ul className="relative z-0 flex flex-col">
                {headings.map((heading, idx) => (
                  <li key={`${heading.id}-${idx}`} style={{ height: rowHeight }}>
                    <button
                      type="button"
                      onClick={() => handleClick(idx)}
                      className={cn(
                        "flex h-full w-full cursor-pointer items-center truncate text-[12px] font-medium leading-none transition-colors duration-200",
                        idx === activeIndex
                          ? "text-foreground"
                          : "text-neutral-400 hover:text-neutral-600 dark:text-zinc-500 dark:hover:text-zinc-300",
                      )}
                      style={{ paddingInlineStart: getItemOffset(heading.depth) }}
                    >
                      {heading.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground/60">
              Add headings to see an outline
            </p>
          )}
        </div>

        {/* File info footer */}
        <div className="border-t border-neutral-200 px-3 py-3 dark:border-zinc-800">
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{readingTime} read</span>
              <span className="text-neutral-300 dark:text-zinc-600">|</span>
              <span>{wordCount} words</span>
            </div>
            {formattedDate ? (
              <div className="text-[10px] text-muted-foreground/50">
                Edited {formattedDate}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
