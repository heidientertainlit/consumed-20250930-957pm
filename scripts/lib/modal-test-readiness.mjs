// Isolated browser-test synchronization only. Do not focus the input here:
// focus and the active modal layer are conditions to verify, not repair.
export function modalInputIsReady(label) {
  const input = document.querySelector(`input[aria-label=${JSON.stringify(label)}]`);
  const dialog = input?.closest('[role="dialog"],[role="alertdialog"]');
  const layer = dialog?.closest("[data-modal-layer]");
  if (!input || !dialog || !layer) return false;
  const style = getComputedStyle(dialog);
  const inputStyle = getComputedStyle(input);
  const rect = input.getBoundingClientRect();
  // A dismissed child's empty/inert portal host can remain mounted. It is not
  // an active modal and must not prevent its still-open parent becoming ready.
  const openLayers = [...document.querySelectorAll("[data-modal-layer]")].filter(candidate =>
    candidate.querySelector('[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]'));
  return dialog.getAttribute("data-state") === "open" &&
    style.opacity === "1" && style.display !== "none" && style.visibility === "visible" &&
    dialog.getAnimations().every(animation => animation.playState === "finished") &&
    rect.width > 0 && rect.height > 0 &&
    inputStyle.visibility === "visible" && inputStyle.display !== "none" &&
    document.activeElement === input && !input.disabled &&
    !input.closest('[inert],[aria-hidden="true"]') && !layer.inert &&
    layer === openLayers.at(-1);
}

export async function waitForModalInputReady(page, label) {
  await page.waitForFunction(modalInputIsReady, label);
}
