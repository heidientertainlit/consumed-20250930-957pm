export type ShareImageResult = "shared" | "downloaded" | "failed";

interface ShareImageBlobOptions {
  fileName: string;
  title: string;
  text?: string;
}

export async function shareImageBlob(
  blob: Blob,
  { fileName, title, text }: ShareImageBlobOptions,
): Promise<ShareImageResult> {
  let nativeShareAvailable = false;
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.Share && cap.Plugins?.Filesystem) {
      nativeShareAvailable = true;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const written = await cap.Plugins.Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: "CACHE",
      });
      await cap.Plugins.Share.share({
        title,
        ...(text ? { text } : {}),
        files: [written.uri],
      });
      return "shared";
    }
  } catch (error: any) {
    if (error?.message?.toLowerCase?.().includes("cancel")) return "failed";
    console.error("Native image share failed:", error);
    if (nativeShareAvailable) return "failed";
  }

  try {
    const file = new File([blob], fileName, { type: "image/png" });
    if (
      typeof navigator.share === "function"
      && (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      await navigator.share({ files: [file], title, ...(text ? { text } : {}) });
      return "shared";
    }
  } catch (error: any) {
    if (error?.name === "AbortError") return "failed";
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch {
    return "failed";
  }
}