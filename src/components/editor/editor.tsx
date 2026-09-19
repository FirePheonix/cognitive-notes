import { useCallback, useEffect, useRef, useState } from "react";
import { Toolbar } from "./toolbar";

/* ───────── serialization helpers ───────── */

type TextNode = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type BlockNode = {
  type: string;
  children: (TextNode | BlockNode)[];
};

function serializeElement(el: Node): (TextNode | BlockNode)[] {
  const result: (TextNode | BlockNode)[] = [];

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) result.push({ text });
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const elem = child as HTMLElement;
    const tag = elem.tagName.toLowerCase();

    // inline marks
    if (tag === "b" || tag === "strong") {
      const inner = serializeElement(elem);
      for (const n of inner) {
        if ("text" in n) n.bold = true;
        result.push(n);
      }
      continue;
    }
    if (tag === "i" || tag === "em") {
      const inner = serializeElement(elem);
      for (const n of inner) {
        if ("text" in n) n.italic = true;
        result.push(n);
      }
      continue;
    }
    if (tag === "u") {
      const inner = serializeElement(elem);
      for (const n of inner) {
        if ("text" in n) n.underline = true;
        result.push(n);
      }
      continue;
    }
    if (tag === "s" || tag === "strike" || tag === "del") {
      const inner = serializeElement(elem);
      for (const n of inner) {
        if ("text" in n) n.strikethrough = true;
        result.push(n);
      }
      continue;
    }
    if (tag === "code" && elem.parentElement?.tagName.toLowerCase() !== "pre") {
      const inner = serializeElement(elem);
      for (const n of inner) {
        if ("text" in n) n.code = true;
        result.push(n);
      }
      continue;
    }
    if (tag === "span") {
      result.push(...serializeElement(elem));
      continue;
    }
    if (tag === "br") {
      result.push({ text: "\n" });
      continue;
    }

    // block-level
    const typeMap: Record<string, string> = {
      h1: "heading-1",
      h2: "heading-2",
      h3: "heading-3",
      p: "paragraph",
      blockquote: "blockquote",
      pre: "code-block",
      ul: "bulleted-list",
      ol: "numbered-list",
      li: "list-item",
      div: "paragraph",
    };

    const blockType = typeMap[tag] ?? "paragraph";
    const children = serializeElement(elem);
    if (children.length === 0) children.push({ text: "" });
    result.push({ type: blockType, children });
  }

  return result;
}

function serializeToJson(container: HTMLElement): string {
  const nodes = serializeElement(container);
  // ensure top-level nodes are blocks
  const blocks: BlockNode[] = [];
  for (const node of nodes) {
    if ("type" in node) {
      blocks.push(node);
    } else {
      // wrap orphan text in paragraph
      if (blocks.length > 0 && blocks[blocks.length - 1].type === "paragraph") {
        blocks[blocks.length - 1].children.push(node);
      } else {
        blocks.push({ type: "paragraph", children: [node] });
      }
    }
  }
  if (blocks.length === 0) blocks.push({ type: "paragraph", children: [{ text: "" }] });
  return JSON.stringify(blocks);
}

function renderTextNode(node: TextNode): string {
  let html = escapeHtml(node.text).replace(/\n/g, "<br>");
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  if (node.strikethrough) html = `<s>${html}</s>`;
  if (node.code) html = `<code class="inline-code">${html}</code>`;
  return html;
}

function renderNode(node: TextNode | BlockNode): string {
  if ("text" in node) return renderTextNode(node);

  const inner = node.children.map(renderNode).join("");

  switch (node.type) {
    case "heading-1":
      return `<h1>${inner}</h1>`;
    case "heading-2":
      return `<h2>${inner}</h2>`;
    case "heading-3":
      return `<h3>${inner}</h3>`;
    case "blockquote":
      return `<blockquote>${inner}</blockquote>`;
    case "code-block":
      return `<pre><code>${inner}</code></pre>`;
    case "bulleted-list":
      return `<ul>${inner}</ul>`;
    case "numbered-list":
      return `<ol>${inner}</ol>`;
    case "list-item":
      return `<li>${inner}</li>`;
    case "paragraph":
    default:
      return `<p>${inner || "<br>"}</p>`;
  }
}

function jsonToHtml(json: string): string {
  try {
    const nodes = JSON.parse(json) as (TextNode | BlockNode)[];
    return nodes.map(renderNode).join("");
  } catch {
    return "<p><br></p>";
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ───────── active state detection ───────── */

function getActiveMarks(): Set<string> {
  const marks = new Set<string>();
  if (document.queryCommandState("bold")) marks.add("bold");
  if (document.queryCommandState("italic")) marks.add("italic");
  if (document.queryCommandState("underline")) marks.add("underline");
  if (document.queryCommandState("strikeThrough")) marks.add("strikethrough");

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    let node: Node | null = sel.anchorNode;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    while (node && node !== document.body) {
      const tag = (node as HTMLElement).tagName?.toLowerCase();
      if (tag === "code" && (node as HTMLElement).parentElement?.tagName.toLowerCase() !== "pre") {
        marks.add("code");
      }
      node = (node as HTMLElement).parentElement;
    }
  }

  return marks;
}

function getActiveBlock(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "p";

  let node: Node | null = sel.anchorNode;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;

  while (node) {
    const tag = (node as HTMLElement).tagName?.toLowerCase();
    if (tag === "h1") return "h1";
    if (tag === "h2") return "h2";
    if (tag === "h3") return "h3";
    if (tag === "blockquote") return "blockquote";
    if (tag === "pre") return "pre";
    if (tag === "ul") return "ul";
    if (tag === "ol") return "ol";
    if ((node as HTMLElement).contentEditable === "true") break;
    node = (node as HTMLElement).parentElement;
  }

  return "p";
}

/* ───────── Editor Component ───────── */

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  fileName: string;
}

export function Editor({ content, onChange, fileName }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeMarks, setActiveMarks] = useState<Set<string>>(new Set());
  const [activeBlock, setActiveBlock] = useState("p");
  const isInternalUpdate = useRef(false);
  const lastContentRef = useRef(content);

  // Load content into editor when file changes
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdate.current) return;
    lastContentRef.current = content;
    editorRef.current.innerHTML = jsonToHtml(content);
  }, [content, fileName]);

  const updateState = useCallback(() => {
    setActiveMarks(getActiveMarks());
    setActiveBlock(getActiveBlock());
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    const json = serializeToJson(editorRef.current);
    lastContentRef.current = json;
    onChange(json);
    updateState();
    requestAnimationFrame(() => {
      isInternalUpdate.current = false;
    });
  }, [onChange, updateState]);

  const handleCommand = useCallback(
    (command: string, value?: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      switch (command) {
        case "bold":
          document.execCommand("bold");
          break;
        case "italic":
          document.execCommand("italic");
          break;
        case "underline":
          document.execCommand("underline");
          break;
        case "strikeThrough":
          document.execCommand("strikeThrough");
          break;
        case "code": {
          // Toggle inline code: wrap/unwrap selection in <code>
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let inCode = false;
            let codeNode: HTMLElement | null = null;
            let node: Node | null = sel.anchorNode;
            while (node && node !== editor) {
              if (
                (node as HTMLElement).tagName?.toLowerCase() === "code" &&
                (node as HTMLElement).parentElement?.tagName.toLowerCase() !== "pre"
              ) {
                inCode = true;
                codeNode = node as HTMLElement;
                break;
              }
              node = node.parentNode;
            }
            if (inCode && codeNode) {
              // unwrap
              const parent = codeNode.parentNode;
              while (codeNode.firstChild) {
                parent?.insertBefore(codeNode.firstChild, codeNode);
              }
              parent?.removeChild(codeNode);
            } else {
              const text = sel.toString();
              if (text) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const code = document.createElement("code");
                code.className = "inline-code";
                code.textContent = text;
                range.insertNode(code);
                // move cursor after the code element
                range.setStartAfter(code);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }
          break;
        }
        case "heading": {
          const level = value ?? "1";
          const tag = `h${level}`;
          const current = getActiveBlock();
          if (current === tag) {
            document.execCommand("formatBlock", false, "p");
          } else {
            document.execCommand("formatBlock", false, tag);
          }
          break;
        }
        case "insertUnorderedList":
          document.execCommand("insertUnorderedList");
          break;
        case "insertOrderedList":
          document.execCommand("insertOrderedList");
          break;
        case "blockquote": {
          const current = getActiveBlock();
          if (current === "blockquote") {
            document.execCommand("formatBlock", false, "p");
          } else {
            document.execCommand("formatBlock", false, "blockquote");
          }
          break;
        }
        case "codeBlock": {
          const current = getActiveBlock();
          if (current === "pre") {
            document.execCommand("formatBlock", false, "p");
          } else {
            document.execCommand("formatBlock", false, "pre");
          }
          break;
        }
        case "removeFormat":
          document.execCommand("removeFormat");
          document.execCommand("formatBlock", false, "p");
          break;
      }

      handleInput();
    },
    [handleInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "b") {
        e.preventDefault();
        handleCommand("bold");
      }
      if (mod && e.key === "i") {
        e.preventDefault();
        handleCommand("italic");
      }
      if (mod && e.key === "u") {
        e.preventDefault();
        handleCommand("underline");
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        handleCommand("code");
      }

      // Tab indentation in code blocks
      if (e.key === "Tab" && getActiveBlock() === "pre") {
        e.preventDefault();
        document.execCommand("insertText", false, "  ");
      }
    },
    [handleCommand],
  );

  return (
    <>
      <div
        ref={editorRef}
        className="editor-content h-full overflow-y-auto px-6 pb-28 pt-2 outline-none md:px-12 lg:px-20 xl:px-28"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={updateState}
        onKeyUp={updateState}
        spellCheck
      />
      <Toolbar
        onCommand={handleCommand}
        activeMarks={activeMarks}
        activeBlock={activeBlock}
      />
    </>
  );
}
