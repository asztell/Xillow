import { useCallback, useState } from "react";
import { readStored, writeStored } from "../lib/storage";

const PANEL_STATE_KEY = "xillow-filters-open";
const NARROW_QUERY = "(max-width: 640px)";

/** Wide screens get an expanded panel by default; narrow ones start collapsed. */
function defaultPanelOpen(): boolean {
  return !(
    typeof window.matchMedia === "function" &&
    window.matchMedia(NARROW_QUERY).matches
  );
}

/**
 * Panel state on load: an explicit choice the user made before wins; otherwise
 * fall back to the viewport default (open on desktop, collapsed on phones).
 */
function readPanelOpen(): boolean {
  const stored = readStored(PANEL_STATE_KEY);
  if (stored === "open") return true;
  if (stored === "closed") return false;
  return defaultPanelOpen();
}

/**
 * Collapsible filter-panel state, remembered across loads.
 *
 * Only an explicit toggle is persisted; the viewport default is re-evaluated on
 * each load so the panel keeps adapting until the user makes a real choice.
 */
export function useFilterPanel(): { open: boolean; toggleOpen: () => void } {
  const [open, setOpen] = useState<boolean>(readPanelOpen);

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      writeStored(PANEL_STATE_KEY, next ? "open" : "closed");
      return next;
    });
  }, []);

  return { open, toggleOpen };
}
