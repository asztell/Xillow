import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "xillow-theme";

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Starting theme: an explicit choice the user made before, otherwise the OS
 * preference. The matching inline script in `index.html` applies this before
 * first paint, so there is no flash of the wrong theme.
 */
function getInitialTheme(): Theme {
  return readStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
}

/**
 * Light/dark switch. Toggles `data-theme` on the document element (which drives
 * the CSS custom properties in `index.css`) and remembers the choice.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode / storage disabled - the theme still applies for the session.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      <span className="theme-toggle-label">
        {theme === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-toggle-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      className="theme-toggle-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="2" x2="12" y2="3.5" />
      <line x1="12" y1="20.5" x2="12" y2="22" />
      <line x1="4.2" y1="4.2" x2="5.3" y2="5.3" />
      <line x1="18.7" y1="18.7" x2="19.8" y2="19.8" />
      <line x1="2" y1="12" x2="3.5" y2="12" />
      <line x1="20.5" y1="12" x2="22" y2="12" />
      <line x1="4.2" y1="19.8" x2="5.3" y2="18.7" />
      <line x1="18.7" y1="5.3" x2="19.8" y2="4.2" />
    </svg>
  );
}
