import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, MainMenu, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "@/hooks/use-theme";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface ExcalidrawCanvasProps {
  content: string;
  onChange: (content: string) => void;
  fileName: string;
}

function parseExcalidrawContent(content: string) {
  try {
    const parsed = JSON.parse(content);
    return {
      elements: parsed.elements ?? [],
      appState: parsed.appState ?? {},
      files: parsed.files ?? {},
    };
  } catch {
    return { elements: [], appState: {}, files: {} };
  }
}

export function ExcalidrawCanvas({
  content,
  onChange,
  fileName,
}: ExcalidrawCanvasProps) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const { resolvedTheme } = useTheme();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeCountRef = useRef(0);
  const suppressSaveRef = useRef(false);

  // Load initial data
  const initialData = useRef(parseExcalidrawContent(content));

  // Save on change — heavily debounced to avoid lag
  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      // Skip saves during file import or first few mount-triggered changes
      if (suppressSaveRef.current) return;

      changeCountRef.current++;
      // Excalidraw fires onChange several times on mount — skip those
      if (changeCountRef.current <= 2) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          const json = serializeAsJSON(
            elements as any,
            appState,
            api?.getFiles() ?? {},
            "local",
          );
          onChange(json);
        } catch {
          // serialization can fail on corrupt state — ignore
        }
      }, 800);
    },
    [onChange, api],
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Handle .excalidraw file import
  const handleImportFile = useCallback(async () => {
    if (!api) return;
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "Excalidraw files",
            accept: {
              "application/json": [".excalidraw", ".json"],
            },
          },
        ],
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = parseExcalidrawContent(text);

      // Suppress saves while importing to prevent lag
      suppressSaveRef.current = true;

      api.updateScene({
        elements: parsed.elements,
      });

      if (parsed.files && Object.keys(parsed.files).length > 0) {
        api.addFiles(Object.values(parsed.files) as any[]);
      }

      // Re-enable saves after a tick
      requestAnimationFrame(() => {
        suppressSaveRef.current = false;
        // Do one save after import settles
        setTimeout(() => {
          try {
            const json = serializeAsJSON(
              api.getSceneElements() as any,
              api.getAppState(),
              api.getFiles(),
              "local",
            );
            onChange(json);
          } catch {
            // ignore
          }
        }, 500);
      });
    } catch {
      suppressSaveRef.current = false;
    }
  }, [api, onChange]);

  // Handle .excalidraw file export
  const handleExportFile = useCallback(async () => {
    if (!api) return;
    try {
      const json = serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        "local",
      );

      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${fileName}.excalidraw`,
        types: [
          {
            description: "Excalidraw file",
            accept: { "application/json": [".excalidraw"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch {
      // User cancelled or API not supported — fallback to download
      try {
        const json = serializeAsJSON(
          api.getSceneElements(),
          api.getAppState(),
          api.getFiles(),
          "local",
        );
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.excalidraw`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }, [api, fileName]);

  // Handle .excalidrawlib library import
  const handleImportLibrary = useCallback(async () => {
    if (!api) return;
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: "Excalidraw library",
            accept: {
              "application/json": [".excalidrawlib", ".json"],
            },
          },
        ],
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.libraryItems || parsed.library) {
        api.updateLibrary({
          libraryItems: parsed.libraryItems ?? parsed.library ?? [],
          openLibraryMenu: true,
        });
      }
    } catch {
      // User cancelled
    }
  }, [api]);

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: "none" }}
      key={fileName}
    >
      <Excalidraw
        excalidrawAPI={(excalidrawApi) => setApi(excalidrawApi)}
        initialData={initialData.current}
        onChange={handleChange}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            toggleTheme: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.Item onSelect={handleImportFile}>
            Open .excalidraw file
          </MainMenu.Item>
          <MainMenu.Item onSelect={handleExportFile}>
            Save as .excalidraw
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.Item onSelect={handleImportLibrary}>
            Import library (.excalidrawlib)
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
