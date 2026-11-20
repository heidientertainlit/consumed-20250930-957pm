// Input visibility alone does not mean a portaled dialog has finished opening.
// Keep the real animation and send Escape only once, to the focused top layer.
export async function waitForModalInputReady(page, label) {
  await page.waitForFunction(label => {
    const input = [...document.querySelectorAll("input[aria-label]")]
      .find(node => node.getAttribute("aria-label") === label);
    const dialog = input?.closest('[role="dialog"]');
    const layer = dialog?.closest("[data-modal-layer]");
    return dialog?.getAttribute("data-state") === "open" &&
      getComputedStyle(dialog).opacity === "1" &&
      dialog.getAnimations().every(animation => animation.playState === "finished") &&
      document.activeElement === input && layer && !layer.inert &&
      layer === [...document.querySelectorAll("[data-modal-layer]")].at(-1);
  }, label);
}
