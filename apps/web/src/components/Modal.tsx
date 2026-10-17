import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface ModalProps {
  /** Called for every dismissal: Esc, backdrop click, or a close control. */
  onClose: () => void;
  /** id of the element that labels the dialog (for screen readers). */
  labelledBy?: string;
  /** Fallback label, used while the `labelledBy` target does not exist yet. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A native `<dialog>` used as an overlay layer.
 *
 * `showModal()` puts the dialog in the top layer: everything behind it is inert
 * (a focus trap) and only the topmost dialog reacts to Esc, which lets the
 * photo lightbox stack over the detail modal without either closing the other.
 * Dismissals are reported to the parent instead of toggling the element, so the
 * URL stays the single source of truth (history is written by the parent).
 */
export function Modal({
  onClose,
  labelledBy,
  label,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        // Environments without `showModal` still show the content.
        dialog.setAttribute("open", "");
      }
    }

    return () => {
      if (typeof dialog.close === "function") {
        dialog.close();
      }
      dialog.removeAttribute("open");
    };
  }, []);

  // Lock background scrolling while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={className ? `modal ${className}` : "modal"}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onCancel={(event) => {
        // Esc: block the native close so the parent owns the dismissal.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A backdrop click lands on the <dialog> element itself, not its content.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
