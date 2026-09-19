import type { AppState, DocNode } from "./types";
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
  remove,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

/* ── Paths ── */

const ROOT_DIR = "vengeance";
const INDEX_FILE = `${ROOT_DIR}/index.json`;
const FILES_DIR = `${ROOT_DIR}/files`;
const DRAWINGS_DIR = `${ROOT_DIR}/drawings`;

const FS_OPTS = { baseDir: BaseDirectory.AppData };

/* ── Helpers ── */

let uid = 0;
export function newId(): string {
  return `${Date.now()}-${++uid}-${Math.random().toString(36).slice(2, 8)}`;
}

function contentPath(node: { id: string; type: string }): string {
  if (node.type === "drawing") return `${DRAWINGS_DIR}/${node.id}.excalidraw`;
  return `${FILES_DIR}/${node.id}.json`;
}

/* ── Strip content from tree for index.json ── */

type IndexNode = Omit<DocNode, "content" | "children"> & {
  children?: IndexNode[];
};

function stripContent(nodes: DocNode[]): IndexNode[] {
  return nodes.map((n) => {
    const { content: _, ...rest } = n;
    if (rest.children) {
      return { ...rest, children: stripContent(rest.children as DocNode[]) };
    }
    return rest;
  });
}

function restoreContent(nodes: IndexNode[]): DocNode[] {
  return nodes.map((n) => {
    const node: DocNode = { ...n } as DocNode;
    if (n.children) {
      node.children = restoreContent(n.children);
    }
    return node;
  });
}

/* ── Ensure directories exist ── */

async function ensureDirs(): Promise<void> {
  for (const dir of [ROOT_DIR, FILES_DIR, DRAWINGS_DIR]) {
    const dirExists = await exists(dir, FS_OPTS);
    if (!dirExists) {
      await mkdir(dir, { ...FS_OPTS, recursive: true });
    }
  }
}

/* ── Default state ── */

function defaultState(): AppState {
  const now = Date.now();
  const welcomeId = newId();
  const gettingStartedId = newId();
  const folderId = newId();
  return {
    tree: [
      {
        id: folderId,
        name: "Getting Started",
        type: "folder",
        createdAt: now,
        updatedAt: now,
        children: [
          {
            id: welcomeId,
            name: "Welcome",
            type: "file",
            createdAt: now,
            updatedAt: now,
            content: JSON.stringify([
              {
                type: "heading-1",
                children: [{ text: "Welcome to Vengeance Notes" }],
              },
              {
                type: "paragraph",
                children: [
                  { text: "This is your " },
                  { text: "lightweight", bold: true },
                  { text: " desktop writing app." },
                ],
              },
              {
                type: "paragraph",
                children: [
                  { text: "Use the sidebar to create " },
                  { text: "folders", bold: true },
                  { text: " and " },
                  { text: "files", bold: true },
                  { text: ". Click a file to open it here in the editor." },
                ],
              },
              {
                type: "heading-2",
                children: [{ text: "Editor features" }],
              },
              {
                type: "bulleted-list",
                children: [
                  {
                    type: "list-item",
                    children: [
                      { text: "Bold", bold: true },
                      { text: ", " },
                      { text: "italic", italic: true },
                      { text: ", " },
                      { text: "underline", underline: true },
                      { text: " formatting" },
                    ],
                  },
                  {
                    type: "list-item",
                    children: [
                      { text: "Inline " },
                      { text: "code", code: true },
                      { text: " spans" },
                    ],
                  },
                  {
                    type: "list-item",
                    children: [{ text: "Headings (H1, H2, H3)" }],
                  },
                  {
                    type: "list-item",
                    children: [{ text: "Bulleted and numbered lists" }],
                  },
                  {
                    type: "list-item",
                    children: [{ text: "Block quotes" }],
                  },
                  {
                    type: "list-item",
                    children: [{ text: "Code blocks" }],
                  },
                ],
              },
              {
                type: "heading-2",
                children: [{ text: "Keyboard shortcuts" }],
              },
              {
                type: "paragraph",
                children: [
                  { text: "Ctrl+B", code: true },
                  { text: " Bold  |  " },
                  { text: "Ctrl+I", code: true },
                  { text: " Italic  |  " },
                  { text: "Ctrl+U", code: true },
                  { text: " Underline  |  " },
                  { text: "Ctrl+E", code: true },
                  { text: " Code" },
                ],
              },
              {
                type: "paragraph",
                children: [
                  { text: "Ctrl+K", code: true },
                  { text: " to search across all your files." },
                ],
              },
            ]),
          },
          {
            id: gettingStartedId,
            name: "Quick Tips",
            type: "file",
            createdAt: now,
            updatedAt: now,
            content: JSON.stringify([
              {
                type: "heading-1",
                children: [{ text: "Quick Tips" }],
              },
              {
                type: "paragraph",
                children: [
                  {
                    text: "Right-click on folders in the sidebar to rename or delete them. Click the ",
                  },
                  { text: "+", code: true },
                  { text: " icons to add new folders or files." },
                ],
              },
              {
                type: "blockquote",
                children: [
                  {
                    type: "paragraph",
                    children: [
                      {
                        text: "Your data is saved to disk automatically. Files are stored in your system's app data directory.",
                      },
                    ],
                  },
                ],
              },
            ]),
          },
        ],
      },
    ],
    activeId: welcomeId,
  };
}

/* ── Save individual file content to disk ── */

async function saveFileContent(node: DocNode): Promise<void> {
  if (node.type === "folder") return;
  if (node.content == null) return;
  const path = contentPath(node);
  await writeTextFile(path, node.content, FS_OPTS);
}

/* ── Save all content from a tree recursively ── */

async function saveAllContent(nodes: DocNode[]): Promise<void> {
  const promises: Promise<void>[] = [];
  function walk(list: DocNode[]) {
    for (const n of list) {
      if (n.type !== "folder" && n.content != null) {
        promises.push(saveFileContent(n));
      }
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  await Promise.all(promises);
}

/* ── Load content for a single node ── */

async function loadFileContent(
  node: DocNode,
): Promise<string | undefined> {
  if (node.type === "folder") return undefined;
  const path = contentPath(node);
  try {
    const fileExists = await exists(path, FS_OPTS);
    if (!fileExists) return undefined;
    return await readTextFile(path, FS_OPTS);
  } catch {
    return undefined;
  }
}

/* ── Delete content file for a node (and children if folder) ── */

async function deleteContentFiles(node: DocNode): Promise<void> {
  if (node.type !== "folder") {
    const path = contentPath(node);
    try {
      const fileExists = await exists(path, FS_OPTS);
      if (fileExists) await remove(path, FS_OPTS);
    } catch {
      // ignore
    }
  }
  if (node.children) {
    await Promise.all(node.children.map(deleteContentFiles));
  }
}

/* ── Load state from disk ── */

export async function loadState(): Promise<AppState> {
  try {
    await ensureDirs();

    const indexExists = await exists(INDEX_FILE, FS_OPTS);
    if (!indexExists) {
      // First launch — create default state and save it
      const state = defaultState();
      await saveState(state);
      return state;
    }

    const raw = await readTextFile(INDEX_FILE, FS_OPTS);
    const parsed = JSON.parse(raw) as { tree: IndexNode[]; activeId: string | null };
    if (!parsed.tree || !Array.isArray(parsed.tree)) {
      const state = defaultState();
      await saveState(state);
      return state;
    }

    // Restore tree without content
    const tree = restoreContent(parsed.tree);

    return {
      tree,
      activeId: parsed.activeId ?? null,
    };
  } catch {
    const state = defaultState();
    try {
      await ensureDirs();
      await saveState(state);
    } catch {
      // ignore
    }
    return state;
  }
}

/* ── Save state to disk ── */

export async function saveState(state: AppState): Promise<void> {
  try {
    await ensureDirs();

    // Save index (tree structure without content)
    const index = {
      tree: stripContent(state.tree),
      activeId: state.activeId,
    };
    await writeTextFile(INDEX_FILE, JSON.stringify(index, null, 2), FS_OPTS);

    // Save all file contents
    await saveAllContent(state.tree);
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

/* ── Save just one file's content (for debounced content changes) ── */

export async function saveNodeContent(node: DocNode): Promise<void> {
  try {
    await saveFileContent(node);
  } catch (err) {
    console.error("Failed to save file content:", err);
  }
}

/* ── Save just the index (for tree structure changes like rename/add/delete) ── */

export async function saveIndex(state: AppState): Promise<void> {
  try {
    await ensureDirs();
    const index = {
      tree: stripContent(state.tree),
      activeId: state.activeId,
    };
    await writeTextFile(INDEX_FILE, JSON.stringify(index, null, 2), FS_OPTS);
  } catch (err) {
    console.error("Failed to save index:", err);
  }
}

/* ── Load content for a specific node by id ── */

export async function loadNodeContent(node: DocNode): Promise<string | undefined> {
  return loadFileContent(node);
}

/* ── Delete node content files ── */

export async function deleteNodeContent(node: DocNode): Promise<void> {
  await deleteContentFiles(node);
}

/* ── Tree helpers (unchanged) ── */

export function findNode(
  nodes: DocNode[],
  id: string,
): DocNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findParent(
  nodes: DocNode[],
  id: string,
): DocNode[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return nodes;
    if (node.children) {
      const found = findParent(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function removeNode(nodes: DocNode[], id: string): DocNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({
      ...n,
      children: n.children ? removeNode(n.children, id) : undefined,
    }));
}

export function addChild(
  nodes: DocNode[],
  parentId: string | null,
  child: DocNode,
): DocNode[] {
  if (parentId === null) return [...nodes, child];
  return nodes.map((n) => {
    if (n.id === parentId && n.type === "folder") {
      return {
        ...n,
        children: [...(n.children ?? []), child],
        updatedAt: Date.now(),
      };
    }
    if (n.children) {
      return { ...n, children: addChild(n.children, parentId, child) };
    }
    return n;
  });
}

export function updateNode(
  nodes: DocNode[],
  id: string,
  updates: Partial<DocNode>,
): DocNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...updates, updatedAt: Date.now() };
    if (n.children) {
      return { ...n, children: updateNode(n.children, id, updates) };
    }
    return n;
  });
}

export function getAllFiles(nodes: DocNode[]): DocNode[] {
  const result: DocNode[] = [];
  for (const node of nodes) {
    if (node.type === "file" || node.type === "drawing") result.push(node);
    if (node.children) result.push(...getAllFiles(node.children));
  }
  return result;
}

export function getFilePath(
  nodes: DocNode[],
  id: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return [...path, node.name];
    if (node.children) {
      const found = getFilePath(node.children, id, [...path, node.name]);
      if (found) return found;
    }
  }
  return null;
}
