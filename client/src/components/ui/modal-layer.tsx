import * as React from "react";

/**
 * One compatibility band above the existing page/composer surfaces (9999/99999)
 * and below toasts (100002) and the mandatory app-update gate. Nested modals use
 * DOM opening order, NOT progressively larger z-index values.
 */
export const MODAL_LAYER = {
  surface: 100001,
  backdrop: 0,
  content: 1,
  floating: 2,
} as const;

const Policy = React.createContext({ enabled: false, modal: true });
const PortalContainer = React.createContext<HTMLElement | undefined>(undefined);

export function ModalLayerPolicy({
  layered,
  modal = true,
  children,
}: React.PropsWithChildren<{ layered?: boolean; modal?: boolean }>) {
  const parent = React.useContext(Policy);
  return <Policy.Provider value={{ enabled: layered ?? parent.enabled, modal }}>{children}</Policy.Provider>;
}

const active: HTMLElement[] = [];
const parents = new WeakMap<HTMLElement, HTMLElement | undefined>();
const originalInert = new Map<HTMLElement, boolean>();
let observer: MutationObserver | undefined;
const lastFocus = new WeakMap<HTMLElement, HTMLElement>();
const blockedEvents = ["pointerdown", "mousedown", "touchstart", "click", "focusin"] as const;

function guardBackground(event: Event) {
  const top = active[active.length - 1];
  if (!top || !(event.target instanceof Node)) return;
  if (top.contains(event.target)) {
    if (event.type === "focusin" && event.target instanceof HTMLElement) lastFocus.set(top, event.target);
    return;
  }
  // iOS 15.0–15.4 has no native inert support. Radix still owns aria hiding,
  // focus scopes and scroll locks; this also protects explicit body portals.
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.type === "focusin") {
    const previous = lastFocus.get(top);
    const target = previous?.isConnected ? previous : top.querySelector<HTMLElement>('[role="dialog"],[role="alertdialog"]');
    target?.focus({ preventScroll: true });
  }
}

function syncBackground() {
  const top = active[active.length - 1];
  if (!top) {
    observer?.disconnect();
    observer = undefined;
    for (const type of blockedEvents) document.removeEventListener(type, guardBackground, true);
    originalInert.forEach((value, element) => { element.inert = value; });
    originalInert.clear();
    return;
  }
  // Includes body-portaled navigation and newly mounted background surfaces.
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = child === top ? false : true;
  }
}

function activate(container: HTMLElement, parent?: HTMLElement) {
  if (active.includes(container)) return;
  parents.set(container, parent);
  // Radix can detach/recompose a parent's ref while a child opens. Preserve the
  // logical parent/child order instead of mistaking that for a new top modal.
  const descendantIndex = active.findIndex(candidate => {
    let ancestor = parents.get(candidate);
    while (ancestor) {
      if (ancestor === container) return true;
      ancestor = parents.get(ancestor);
    }
    return false;
  });
  const index = descendantIndex < 0 ? active.length : descendantIndex;
  document.body.insertBefore(container, active[index] ?? null);
  active.splice(index, 0, container);
  syncBackground();
  if (!observer) {
    for (const type of blockedEvents) document.addEventListener(type, guardBackground, { capture: true, passive: false });
    observer = new MutationObserver(syncBackground);
    observer.observe(document.body, { childList: true });
  }
}

function deactivate(container: HTMLElement) {
  const index = active.indexOf(container);
  if (index >= 0) active.splice(index, 1);
  syncBackground();
}

/** Keep Radix/Vaul responsible for focus trapping, dismissal and scroll locks. */
export function useModalLayer<T extends HTMLElement>(forwardedRef: React.ForwardedRef<T>) {
  const policy = React.useContext(Policy);
  const parentContainer = React.useContext(PortalContainer);
  const enabled = policy.enabled && policy.modal;
  const element = React.useRef<T | null>(null);
  const latestRef = React.useRef(forwardedRef);
  latestRef.current = forwardedRef;
  const [container] = React.useState(() => {
    if (typeof document === "undefined") return undefined;
    const node = document.createElement("div");
    node.dataset.modalLayer = "";
    Object.assign(node.style, {
      position: "fixed", inset: "0", pointerEvents: "none",
      zIndex: String(MODAL_LAYER.surface),
    });
    return node;
  });
  const ref = React.useCallback((node: T | null) => {
    element.current = node;
    if (enabled && container) {
      if (node) activate(container, parentContainer);
      else {
        // Radix/Vaul may null then restore a composed ref in the same commit.
        // Moving/inerting a live host between pointerdown and click loses the
        // click and pointer capture. Only unregister an actual disappearance.
        queueMicrotask(() => {
          if (!element.current) deactivate(container);
        });
      }
    }
    if (typeof latestRef.current === "function") latestRef.current(node);
    else if (latestRef.current) latestRef.current.current = node;
  }, [enabled, container, parentContainer]);

  // Vaul composes a new forwarded ref during drag/focus state changes. Do not
  // move the portal host during pointerdown: that cancels the eventual click.
  React.useLayoutEffect(() => {
    if (typeof forwardedRef === "function") forwardedRef(element.current);
    else if (forwardedRef) forwardedRef.current = element.current;
    return () => {
      if (typeof forwardedRef === "function") forwardedRef(null);
      else if (forwardedRef) forwardedRef.current = null;
    };
  }, [forwardedRef]);

  React.useLayoutEffect(() => {
    if (!enabled || !container) return;
    // React StrictMode replays effects without remounting refs.
    if (container.childElementCount) activate(container, parentContainer);
    return () => {
      deactivate(container);
      container.remove();
    };
  }, [enabled, container, parentContainer]);

  return {
    ref,
    container: enabled ? container : undefined,
    contentStyle: enabled ? { zIndex: MODAL_LAYER.content, pointerEvents: "auto" as const } : {},
    overlayStyle: enabled ? { zIndex: MODAL_LAYER.backdrop, pointerEvents: "auto" as const } : {},
  };
}

export function ModalLayerContents({
  container, children,
}: React.PropsWithChildren<{ container?: HTMLElement }>) {
  // Non-managed nested content must not erase an existing managed container.
  const parent = React.useContext(PortalContainer);
  return <PortalContainer.Provider value={container ?? parent}>{children}</PortalContainer.Provider>;
}

export function useModalFloatingLayer() {
  const container = React.useContext(PortalContainer);
  return {
    container,
    style: container ? { zIndex: MODAL_LAYER.floating, pointerEvents: "auto" as const } : {},
  };
}
