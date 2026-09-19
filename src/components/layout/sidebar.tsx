import { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronUp,
  FolderPlus,
  FilePlus,
  Trash2,
  Pencil,
  Folder,
  FileText,
  PenTool,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocNode } from "@/lib/types";

interface SidebarProps {
  tree: DocNode[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddFile: (parentId: string | null) => void;
  onAddDrawing: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function InlineRename({
  initialName,
  onConfirm,
  onCancel,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialName);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const trimmed = value.trim();
          if (trimmed) onConfirm(trimmed);
          else onCancel();
        }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initialName) onConfirm(trimmed);
        else onCancel();
      }}
      className="w-full rounded border border-ring/40 bg-background px-1.5 py-0.5 text-sm outline-none"
    />
  );
}

function SidebarItem({
  node,
  depth,
  activeId,
  onSelect,
  onAddFolder,
  onAddFile,
  onAddDrawing,
  onDelete,
  onRename,
}: {
  node: DocNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddFile: (parentId: string | null) => void;
  onAddDrawing: (parentId: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isActive = node.id === activeId;
  const isFolder = node.type === "folder";
  const isDrawing = node.type === "drawing";

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors select-none",
          isActive
            ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-zinc-800/80 dark:text-white"
            : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (isFolder) setCollapsed((c) => !c);
          else onSelect(node.id);
        }}
      >
        {isFolder ? (
          <>
            <ChevronUp
              className={cn(
                "h-3 w-3 shrink-0 text-neutral-400 transition-transform duration-300 dark:text-zinc-500",
                collapsed ? "rotate-180" : "rotate-0",
              )}
            />
            <Folder className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-zinc-400" />
          </>
        ) : isDrawing ? (
          <>
            <span className="w-3" />
            <PenTool className="h-3.5 w-3.5 shrink-0 text-violet-400 dark:text-violet-500" />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-zinc-500" />
          </>
        )}

        {renaming ? (
          <InlineRename
            initialName={node.name}
            onConfirm={(name) => {
              onRename(node.id, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}

        {hovered && !renaming ? (
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {isFolder ? (
              <>
                <button
                  type="button"
                  title="New folder inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFolder(node.id);
                  }}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="New file inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFile(node.id);
                  }}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="New drawing inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddDrawing(node.id);
                  }}
                  className="rounded p-0.5 text-violet-400 hover:text-violet-600 dark:text-violet-500 dark:hover:text-violet-300"
                >
                  <PenTool className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
              className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="rounded p-0.5 text-neutral-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ) : null}
      </div>

      {isFolder && !collapsed && node.children ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "grid-rows-[1fr] opacity-100",
          )}
        >
          <div className="overflow-hidden">
            {node.children.map((child) => (
              <SidebarItem
                key={child.id}
                node={child}
                depth={depth + 1}
                activeId={activeId}
                onSelect={onSelect}
                onAddFolder={onAddFolder}
                onAddFile={onAddFile}
                onAddDrawing={onAddDrawing}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  tree,
  activeId,
  onSelect,
  onAddFolder,
  onAddFile,
  onAddDrawing,
  onDelete,
  onRename,
}: SidebarProps) {
  const handleAddRootFolder = useCallback(() => onAddFolder(null), [onAddFolder]);
  const handleAddRootFile = useCallback(() => onAddFile(null), [onAddFile]);
  const handleAddRootDrawing = useCallback(() => onAddDrawing(null), [onAddDrawing]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-zinc-800">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            title="New folder"
            onClick={handleAddRootFolder}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="New file"
            onClick={handleAddRootFile}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <FilePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="New drawing"
            onClick={handleAddRootDrawing}
            className="rounded p-1 text-violet-400 transition-colors hover:bg-violet-50 hover:text-violet-600 dark:text-violet-500 dark:hover:bg-violet-900/20 dark:hover:text-violet-300"
          >
            <PenTool className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            No files yet. Click + to add one.
          </p>
        ) : (
          tree.map((node) => (
            <SidebarItem
              key={node.id}
              node={node}
              depth={0}
              activeId={activeId}
              onSelect={onSelect}
              onAddFolder={onAddFolder}
              onAddFile={onAddFile}
              onAddDrawing={onAddDrawing}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))
        )}
      </div>
    </div>
  );
}
