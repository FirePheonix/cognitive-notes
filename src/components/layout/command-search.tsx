import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocNode } from "@/lib/types";
import { getAllFiles } from "@/lib/storage";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseQueryTerms(query: string) {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function highlightText(text: string, terms: string[]) {
  if (!text) return text;
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isMatch = terms.some(
      (term) => part.toLowerCase() === term.toLowerCase(),
    );
    if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>;
    return (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-amber-200/90 px-0.5 text-foreground dark:bg-amber-400/35 dark:text-zinc-100"
      >
        {part}
      </mark>
    );
  });
}

function extractPlainText(content: string | undefined): string {
  if (!content) return "";
  try {
    const nodes = JSON.parse(content) as Array<{ children?: Array<{ text?: string; children?: Array<{ children?: Array<{ text?: string }> }> }> }>;
    const texts: string[] = [];
    function walk(arr: unknown[]) {
      for (const node of arr) {
        const n = node as Record<string, unknown>;
        if (typeof n.text === "string") texts.push(n.text);
        if (Array.isArray(n.children)) walk(n.children);
      }
    }
    walk(nodes);
    return texts.join(" ");
  } catch {
    return "";
  }
}

interface CommandSearchProps {
  open: boolean;
  onClose: () => void;
  tree: DocNode[];
  onSelect: (id: string) => void;
}

export function CommandSearch({ open, onClose, tree, onSelect }: CommandSearchProps) {
  const [query, setQuery] = useState("");

  const files = useMemo(() => getAllFiles(tree), [tree]);

  const filtered = useMemo(() => {
    const terms = parseQueryTerms(query);
    if (terms.length === 0) {
      return files.slice(0, 40).map((f) => ({ ...f, score: 0 }));
    }

    return files
      .map((file) => {
        const name = file.name.toLowerCase();
        const body = extractPlainText(file.content).toLowerCase();
        let score = 0;

        for (const term of terms) {
          if (name === term) score += 20;
          if (name.startsWith(term)) score += 12;
          if (name.includes(term)) score += 8;
          if (body.includes(term)) score += 3;
        }

        const allPresent = terms.every(
          (term) => name.includes(term) || body.includes(term),
        );
        if (allPresent) score += 10;

        return { ...file, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }, [files, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-start justify-center p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-foreground/10 bg-background/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
          />
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          ) : (
            filtered.map((file) => {
              const terms = parseQueryTerms(query);
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    onSelect(file.id);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {highlightText(file.name, terms)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
