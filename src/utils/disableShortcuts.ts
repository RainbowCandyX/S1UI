export function installShortcutGuards() {
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    if (key === "f5") {
      e.preventDefault();
      return;
    }
    if (ctrlOrMeta && (key === "r" || key === "s" || key === "p")) {
      e.preventDefault();
      return;
    }
    if (ctrlOrMeta && e.shiftKey && key === "r") {
      e.preventDefault();
      return;
    }
  };

  window.addEventListener("contextmenu", onContextMenu, { capture: true });
  window.addEventListener("keydown", onKeyDown, { capture: true });
}
