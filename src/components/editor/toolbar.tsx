import {
  Bold,
  Italic,
  Underline,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  onCommand: (command: string, value?: string) => void;
  activeMarks: Set<string>;
  activeBlock: string;
}

type ToolbarItem =
  | { kind: "button"; command: string; value?: string; icon: React.ReactNode; label: string; isActive?: boolean }
  | { kind: "separator" };

export function Toolbar({ onCommand, activeMarks, activeBlock }: ToolbarProps) {
  const items: ToolbarItem[] = [
    {
      kind: "button",
      command: "bold",
      icon: <Bold className="h-[15px] w-[15px]" />,
      label: "Bold (Ctrl+B)",
      isActive: activeMarks.has("bold"),
    },
    {
      kind: "button",
      command: "italic",
      icon: <Italic className="h-[15px] w-[15px]" />,
      label: "Italic (Ctrl+I)",
      isActive: activeMarks.has("italic"),
    },
    {
      kind: "button",
      command: "underline",
      icon: <Underline className="h-[15px] w-[15px]" />,
      label: "Underline (Ctrl+U)",
      isActive: activeMarks.has("underline"),
    },
    {
      kind: "button",
      command: "strikeThrough",
      icon: <Strikethrough className="h-[15px] w-[15px]" />,
      label: "Strikethrough",
      isActive: activeMarks.has("strikethrough"),
    },
    {
      kind: "button",
      command: "code",
      icon: <Code className="h-[15px] w-[15px]" />,
      label: "Inline Code (Ctrl+E)",
      isActive: activeMarks.has("code"),
    },
    { kind: "separator" },
    {
      kind: "button",
      command: "heading",
      value: "1",
      icon: <Heading1 className="h-[15px] w-[15px]" />,
      label: "Heading 1",
      isActive: activeBlock === "h1",
    },
    {
      kind: "button",
      command: "heading",
      value: "2",
      icon: <Heading2 className="h-[15px] w-[15px]" />,
      label: "Heading 2",
      isActive: activeBlock === "h2",
    },
    {
      kind: "button",
      command: "heading",
      value: "3",
      icon: <Heading3 className="h-[15px] w-[15px]" />,
      label: "Heading 3",
      isActive: activeBlock === "h3",
    },
    { kind: "separator" },
    {
      kind: "button",
      command: "insertUnorderedList",
      icon: <List className="h-[15px] w-[15px]" />,
      label: "Bullet List",
      isActive: activeBlock === "ul",
    },
    {
      kind: "button",
      command: "insertOrderedList",
      icon: <ListOrdered className="h-[15px] w-[15px]" />,
      label: "Numbered List",
      isActive: activeBlock === "ol",
    },
    {
      kind: "button",
      command: "blockquote",
      icon: <Quote className="h-[15px] w-[15px]" />,
      label: "Block Quote",
      isActive: activeBlock === "blockquote",
    },
    {
      kind: "button",
      command: "codeBlock",
      icon: <SquareCode className="h-[15px] w-[15px]" />,
      label: "Code Block",
      isActive: activeBlock === "pre",
    },
    { kind: "separator" },
    {
      kind: "button",
      command: "removeFormat",
      icon: <RemoveFormatting className="h-[15px] w-[15px]" />,
      label: "Clear Formatting",
    },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 z-[300] -translate-x-1/2">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-2xl px-3 py-2",
          "border border-neutral-200/60 bg-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl",
          "dark:border-zinc-700/50 dark:bg-zinc-900/80 dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
        )}
      >
        {items.map((item, i) => {
          if (item.kind === "separator") {
            return (
              <div
                key={`sep-${i}`}
                className="mx-1 h-5 w-px bg-neutral-200/80 dark:bg-zinc-600/50"
              />
            );
          }
          return (
            <button
              key={`${item.command}-${item.value ?? ""}`}
              type="button"
              title={item.label}
              onMouseDown={(e) => {
                e.preventDefault();
                onCommand(item.command, item.value);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150",
                item.isActive
                  ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-white",
              )}
            >
              {item.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
