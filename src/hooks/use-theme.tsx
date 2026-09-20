import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

function getSystemTheme(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(theme: Theme): Resolved {
  return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("cognitive-theme") as Theme) ?? "system";
    } catch {
      return "system";
    }
  });
  const [resolved, setResolved] = useState<Resolved>(() => resolve(theme));

  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t);
    localStorage.setItem("cognitive-theme", t);
  }, []);

  useEffect(() => {
    setResolved(resolve(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
