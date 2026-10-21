export type Backend = "node" | "go";

interface BackendToggleProps {
  value: Backend;
  onChange: (next: Backend) => void;
}

/**
 * Segmented toggle between the two API implementations. Lives in the sticky
 * footer so the active backend can be switched without losing the current
 * search.
 */
export function BackendToggle({ value, onChange }: BackendToggleProps) {
  const isGo = value === "go";

  return (
    <div className="backend-toggle" role="group" aria-label="API backend">
      <button
        type="button"
        className={`backend-toggle-option${!isGo ? " is-active" : ""}`}
        aria-pressed={!isGo}
        onClick={() => onChange("node")}
      >
        Node
      </button>
      <button
        type="button"
        className="backend-toggle-track"
        role="switch"
        aria-checked={isGo}
        aria-label="Toggle API backend"
        onClick={() => onChange(isGo ? "node" : "go")}
      >
        <span className="backend-toggle-thumb" />
      </button>
      <button
        type="button"
        className={`backend-toggle-option${isGo ? " is-active" : ""}`}
        aria-pressed={isGo}
        onClick={() => onChange("go")}
      >
        Go
      </button>
    </div>
  );
}
