import { useEffect, useRef, useState } from "react";
import { X, Share2, Download, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import logoPath from "@assets/consumed_logo_purple_trimmed.png";

interface ShareRatingCardProps {
  isOpen: boolean;
  onClose: () => void;
  mediaTitle: string;
  mediaImage?: string | null;
  mediaType?: string | null;
  rating?: number | null;
  review?: string | null;
  displayName: string;
}

const W = 1080;
const H = 1920;

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  else if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 0) last = last.slice(0, -1);
    lines[maxLines - 1] = last.replace(/[\s,.]+$/, "") + "…";
  }
  return lines;
}

function loadImageOnce(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const direct = await loadImageOnce(src);
  if (direct) return direct;
  // Retry through a CORS-friendly image proxy for hosts that block cross-origin canvas use
  try {
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(src.replace(/^https?:\/\//, ""))}`;
    return await loadImageOnce(proxied);
  } catch {
    return null;
  }
}

async function renderCard(props: ShareRatingCardProps): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background — clean white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header — "Name shared on @consumed"
  const namePart = props.displayName;
  const restPart = " shared on @consumed";
  ctx.textAlign = "left";
  ctx.font = "700 38px -apple-system, 'Segoe UI', sans-serif";
  const nameW = ctx.measureText(namePart).width;
  ctx.font = "500 38px -apple-system, 'Segoe UI', sans-serif";
  const restW = ctx.measureText(restPart).width;
  let hx = (W - (nameW + restW)) / 2;
  ctx.font = "700 38px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#1f1b2e";
  ctx.fillText(namePart, hx, 160);
  hx += nameW;
  ctx.font = "500 38px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#8b84a0";
  ctx.fillText(restPart, hx, 160);

  // Poster
  const posterW = 560;
  const posterH = 840;
  const posterX = (W - posterW) / 2;
  const posterY = 250;
  const img = props.mediaImage ? await loadImage(props.mediaImage) : null;
  ctx.save();
  roundRect(ctx, posterX, posterY, posterW, posterH, 32);
  ctx.shadowColor = "rgba(76, 29, 149, 0.25)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 28;
  ctx.fillStyle = "#f3f0fa";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, posterX, posterY, posterW, posterH, 32);
  ctx.clip();
  if (img) {
    const scale = Math.max(posterW / img.width, posterH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, posterX + (posterW - dw) / 2, posterY + (posterH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#ede9f8";
    ctx.fillRect(posterX, posterY, posterW, posterH);
    ctx.fillStyle = "#7c6bb0";
    ctx.font = "600 44px -apple-system, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    const titleLines = wrapText(ctx, props.mediaTitle, posterW - 80, 4);
    titleLines.forEach((l, i) => ctx.fillText(l, posterX + posterW / 2, posterY + posterH / 2 - ((titleLines.length - 1) * 28) + i * 56));
  }
  ctx.restore();

  let y = posterY + posterH + 90;

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = "#1f1b2e";
  ctx.font = "700 60px -apple-system, 'Segoe UI', sans-serif";
  const tLines = wrapText(ctx, props.mediaTitle, W - 160, 2);
  tLines.forEach((l) => { ctx.fillText(l, W / 2, y); y += 72; });
  y += 16;

  // Stars
  if (props.rating && props.rating > 0) {
    const starR = 38;
    const gap = 96;
    const startX = W / 2 - gap * 2;
    for (let i = 1; i <= 5; i++) {
      const cx = startX + (i - 1) * gap;
      drawStar(ctx, cx, y, starR);
      ctx.fillStyle = "#e5e1f0";
      ctx.fill();
      const fillPct = Math.max(0, Math.min(1, props.rating - (i - 1)));
      if (fillPct > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - starR, y - starR, starR * 2 * fillPct, starR * 2);
        ctx.clip();
        drawStar(ctx, cx, y, starR);
        ctx.fillStyle = "#facc15";
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = "#b45309";
    ctx.font = "700 44px -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(`${props.rating % 1 === 0 ? props.rating : props.rating.toFixed(1)} / 5`, W / 2, y + 110);
    y += 190;
  }

  // Review quote
  if (props.review?.trim()) {
    ctx.fillStyle = "#3f3a52";
    ctx.font = "italic 400 42px Georgia, serif";
    const qLines = wrapText(ctx, `\u201C${props.review.trim()}\u201D`, W - 240, 4);
    qLines.forEach((l) => { ctx.fillText(l, W / 2, y); y += 58; });
    y += 20;
  }

  // Attribution
  ctx.fillStyle = "#6b6580";
  ctx.font = "600 36px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(`— ${props.displayName}`, W / 2, Math.min(y + 20, H - 220));

  // Branding footer — logo image + tagline
  const logo = await loadImageOnce(logoPath);
  if (logo) {
    const logoW = 380;
    const logoH = logoW * (logo.height / logo.width);
    ctx.drawImage(logo, (W - logoW) / 2, H - 118 - logoH, logoW, logoH);
  } else {
    ctx.fillStyle = "#7c3aed";
    ctx.font = "800 52px -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText("consumed", W / 2, H - 130);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#9a93ad";
  ctx.font = "500 32px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("Entertainment is better, together.", W / 2, H - 72);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function shareBlob(blob: Blob, title: string): Promise<"shared" | "downloaded" | "failed"> {
  const fileName = `consumed-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "rating"}.png`;

  // 1) Capacitor native share (available after the iOS app adds @capacitor/share + @capacitor/filesystem)
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.Share && cap.Plugins?.Filesystem) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const written = await cap.Plugins.Filesystem.writeFile({ path: fileName, data: base64, directory: "CACHE" });
      await cap.Plugins.Share.share({ title, files: [written.uri] });
      return "shared";
    }
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("cancel")) return "failed";
    // fall through to web share
  }

  // 2) Web Share API with file (works in Safari/iOS browsers)
  try {
    const file = new File([blob], fileName, { type: "image/png" });
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "failed";
  }

  // 3) Fallback: download the image
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export function ShareRatingCard(props: ShareRatingCardProps) {
  const { isOpen, onClose } = props;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPreviewUrl(null);
    setNotice(null);
    blobRef.current = null;
    renderCard(props).then((blob) => {
      if (cancelled) return;
      if (!blob) { setNotice("Couldn't generate the image — please try again"); return; }
      blobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, props.mediaTitle, props.rating, props.review, props.mediaImage, props.displayName]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleShare = async (forceDownload = false) => {
    if (!blobRef.current || sharing) return;
    setSharing(true);
    setNotice(null);
    try {
      if (forceDownload) {
        const url = URL.createObjectURL(blobRef.current);
        const a = document.createElement("a");
        a.href = url;
        a.download = `consumed-${props.mediaTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "rating"}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setNotice("Image saved");
      } else {
        const result = await shareBlob(blobRef.current, `${props.mediaTitle} on Consumed`);
        if (result === "downloaded") setNotice("Sharing not available here — image downloaded instead");
      }
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center px-3" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-sm bg-gray-950 rounded-3xl p-4 pb-6 max-h-[86vh] overflow-y-auto -mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-white font-semibold text-[15px]">Share your rating</p>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-gray-900 flex items-center justify-center" style={{ aspectRatio: "9 / 16" }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Rating card preview" className="w-full h-full object-contain" />
          ) : (
            <Loader2 size={28} className="text-violet-400 animate-spin" />
          )}
        </div>

        {notice && <p className="text-[12px] text-violet-300 text-center mt-3">{notice}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleShare(false)}
            disabled={!previewUrl || sharing}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-[14px] py-3 rounded-xl"
          >
            {sharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            Share with a friend
          </button>
          <button
            onClick={() => handleShare(true)}
            disabled={!previewUrl || sharing}
            aria-label="Save image"
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-medium text-[14px] px-4 py-3 rounded-xl"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
