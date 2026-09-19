import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import {
  RightSidebar,
  type OutlineHeading,
} from "@/components/layout/right-sidebar";
import { CommandSearch } from "@/components/layout/command-search";
import { Editor } from "@/components/editor/editor";
import { ExcalidrawCanvas } from "@/components/editor/excalidraw-canvas";
import { ThemeProvider } from "@/hooks/use-theme";
import type { AppState, DocNode } from "@/lib/types";
import {
  loadState,
  saveIndex,
  saveNodeContent,
  loadNodeContent,
  deleteNodeContent,
  newId,
  findNode,
  removeNode,
  addChild,
  updateNode,
  getFilePath,
} from "@/lib/storage";

/* ── extract headings + stats from serialized editor JSON ── */

function extractHeadings(content: string): OutlineHeading[] {
  try {
    const nodes = JSON.parse(content) as Array<{
      type?: string;
      children?: Array<{ text?: string }>;
    }>;
    const headings: OutlineHeading[] = [];
    const slugCounts = new Map<string, number>();

    for (const node of nodes) {
      let depth = 0;
      if (node.type === "heading-1") depth = 1;
      else if (node.type === "heading-2") depth = 2;
      else if (node.type === "heading-3") depth = 3;
      if (depth === 0) continue;

      const title = (node.children ?? [])
        .map((c) => c.text ?? "")
        .join("")
        .trim();
      if (!title) continue;

      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      const count = (slugCounts.get(baseSlug) ?? 0) + 1;
      slugCounts.set(baseSlug, count);
      const id = count > 1 ? `${baseSlug}-${count}` : baseSlug;

      headings.push({ id, title, depth });
    }
    return headings;
  } catch {
    return [];
  }
}

function extractWordCount(content: string): number {
  try {
    const nodes = JSON.parse(content) as Array<unknown>;
    const texts: string[] = [];
    function walk(arr: unknown[]) {
      for (const node of arr) {
        const n = node as Record<string, unknown>;
        if (typeof n.text === "string") texts.push(n.text);
        if (Array.isArray(n.children)) walk(n.children);
      }
    }
    walk(nodes);
    const joined = texts.join(" ").trim();
    if (!joined) return 0;
    return joined.split(/\s+/).length;
  } catch {
    return 0;
  }
}

/* ── App ── */

function AppInner() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);

  // Track loaded content per node id (lazy loaded from disk)
  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const indexSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load state from disk on mount
  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (cancelled) return;
      setState(s);
      setLoading(false);

      // If there's an active file, load its content
      if (s.activeId) {
        const node = findNode(s.tree, s.activeId);
        if (node && node.type !== "folder") {
          loadNodeContent(node).then((content) => {
            if (cancelled || !content) return;
            setContentCache((prev) => ({ ...prev, [node.id]: content }));
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced index save (tree structure changes)
  const debouncedSaveIndex = useCallback((newState: AppState) => {
    if (indexSaveTimerRef.current) clearTimeout(indexSaveTimerRef.current);
    indexSaveTimerRef.current = setTimeout(() => {
      saveIndex(newState);
    }, 300);
  }, []);

  // Debounced content save (file content changes)
  const debouncedSaveContent = useCallback((node: DocNode) => {
    if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
    contentSaveTimerRef.current = setTimeout(() => {
      saveNodeContent(node);
    }, 500);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
      if (indexSaveTimerRef.current) clearTimeout(indexSaveTimerRef.current);
    };
  }, []);

  // Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const setTree = useCallback(
    (fn: (tree: DocNode[]) => DocNode[]) => {
      setState((prev) => {
        if (!prev) return prev;
        const newState = { ...prev, tree: fn(prev.tree) };
        debouncedSaveIndex(newState);
        return newState;
      });
    },
    [debouncedSaveIndex],
  );

  const setActiveId = useCallback(
    (id: string | null) => {
      setState((prev) => {
        if (!prev) return prev;
        const newState = { ...prev, activeId: id };
        debouncedSaveIndex(newState);
        return newState;
      });

      // Lazy-load content when selecting a file
      if (id && state) {
        const node = findNode(state.tree, id);
        if (node && node.type !== "folder" && !contentCache[id]) {
          loadNodeContent(node).then((content) => {
            if (content) {
              setContentCache((prev) => ({ ...prev, [id]: content }));
            }
          });
        }
      }
    },
    [state, contentCache, debouncedSaveIndex],
  );

  const handleSelect = useCallback(
    (id: string) => setActiveId(id),
    [setActiveId],
  );

  const handleAddFolder = useCallback(
    (parentId: string | null) => {
      const node: DocNode = {
        id: newId(),
        name: "New Folder",
        type: "folder",
        children: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setTree((tree) => addChild(tree, parentId, node));
    },
    [setTree],
  );

  const handleAddFile = useCallback(
    (parentId: string | null) => {
      const node: DocNode = {
        id: newId(),
        name: "Untitled",
        type: "file",
        content: JSON.stringify([
          { type: "paragraph", children: [{ text: "" }] },
        ]),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // Save content to disk immediately
      saveNodeContent(node);
      // Cache it
      setContentCache((prev) => ({ ...prev, [node.id]: node.content! }));
      setTree((tree) => addChild(tree, parentId, node));
      setActiveId(node.id);
    },
    [setTree, setActiveId],
  );

  const handleAddDrawing = useCallback(
    (parentId: string | null) => {
      const defaultContent = JSON.stringify({
        elements: [],
        appState: {},
        files: {},
      });
      const node: DocNode = {
        id: newId(),
        name: "Untitled Drawing",
        type: "drawing",
        content: defaultContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      saveNodeContent(node);
      setContentCache((prev) => ({ ...prev, [node.id]: defaultContent }));
      setTree((tree) => addChild(tree, parentId, node));
      setActiveId(node.id);
    },
    [setTree, setActiveId],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!state) return;
      const node = findNode(state.tree, id);
      if (node) {
        // Delete content files from disk
        deleteNodeContent(node);
      }
      // Remove from content cache
      setContentCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTree((tree) => removeNode(tree, id));
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          activeId: prev.activeId === id ? null : prev.activeId,
        };
      });
    },
    [state, setTree],
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      setTree((tree) => updateNode(tree, id, { name }));
    },
    [setTree],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!state?.activeId) return;
      const id = state.activeId;

      // Update cache
      setContentCache((prev) => ({ ...prev, [id]: content }));

      // Update tree node content (in memory)
      setTree((tree) => updateNode(tree, id, { content }));

      // Debounced save just this file's content to disk
      const node = findNode(state.tree, id);
      if (node) {
        debouncedSaveContent({ ...node, content });
      }
    },
    [state?.activeId, state?.tree, setTree, debouncedSaveContent],
  );

  if (loading || !state) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground dark:border-zinc-700 dark:border-t-white" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const activeNode = state.activeId
    ? findNode(state.tree, state.activeId)
    : null;

  // Get content from cache (lazy loaded from disk)
  const activeContent = activeNode
    ? contentCache[activeNode.id] ?? activeNode.content ?? ""
    : "";

  const filePath = state.activeId
    ? getFilePath(state.tree, state.activeId)
    : null;

  const headings = extractHeadings(
    activeNode?.type === "file" ? activeContent : "",
  );

  const wordCount = extractWordCount(
    activeNode?.type === "file" ? activeContent : "",
  );

  const readingTime = `${Math.max(1, Math.round(wordCount / 220))} min`;

  const hasFile = activeNode && activeNode.type === "file";
  const hasDrawing = activeNode && activeNode.type === "drawing";

  // Check if content is still loading for the active file
  const contentLoading =
    activeNode &&
    activeNode.type !== "folder" &&
    !contentCache[activeNode.id] &&
    !activeNode.content;

  return (
    <div className="flex h-screen flex-col">
      <Navbar
        onOpenSearch={() => setSearchOpen(true)}
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen((v) => !v)}
        breadcrumb={filePath}
      />

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="hidden w-[240px] shrink-0 border-r border-neutral-200 bg-neutral-50/30 dark:border-zinc-800 dark:bg-zinc-950/50 md:block lg:w-[260px]">
          <Sidebar
            tree={state.tree}
            activeId={state.activeId}
            onSelect={handleSelect}
            onAddFolder={handleAddFolder}
            onAddFile={handleAddFile}
            onAddDrawing={handleAddDrawing}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </aside>

        {/* Decorative divider */}
        <div className="relative hidden w-6 opacity-60 md:block">
          <div
            className="absolute inset-0 border-l border-r border-neutral-200 dark:hidden"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, rgba(0,0,0,0.06), rgba(0,0,0,0.06) 1px, transparent 1px, transparent 6px)",
              backgroundSize: "16px 16px",
            }}
          />
          <div
            className="absolute inset-0 hidden border-l border-r border-white/10 dark:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 1px, transparent 1px, transparent 6px)",
              backgroundSize: "16px 16px",
            }}
          />
        </div>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col">
          {contentLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground dark:border-zinc-700 dark:border-t-white" />
                <p className="text-xs text-muted-foreground">
                  Loading file...
                </p>
              </div>
            </div>
          ) : hasDrawing ? (
            <div className="min-h-0 flex-1">
              <ExcalidrawCanvas
                key={activeNode.id}
                content={activeContent}
                onChange={handleContentChange}
                fileName={activeNode.name}
              />
            </div>
          ) : hasFile ? (
            <div className="min-h-0 flex-1">
              <Editor
                key={activeNode.id}
                content={activeContent}
                onChange={handleContentChange}
                fileName={activeNode.name}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="text-6xl text-neutral-200 dark:text-zinc-800">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto h-16 w-16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="M10 13h4" />
                    <path d="M10 17h4" />
                    <path d="M10 9h1" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a file from the sidebar, or create a new one
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Ctrl+K to search
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar (outline) — only for text files */}
        {hasFile ? (
          <RightSidebar
            open={outlineOpen}
            onClose={() => setOutlineOpen(false)}
            headings={headings}
            fileName={activeNode.name}
            wordCount={wordCount}
            readingTime={readingTime}
            updatedAt={activeNode.updatedAt}
          />
        ) : null}
      </div>

      <CommandSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tree={state.tree}
        onSelect={(id) => {
          setActiveId(id);
          setSearchOpen(false);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
