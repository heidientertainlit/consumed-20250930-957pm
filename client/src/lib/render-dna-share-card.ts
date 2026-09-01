import consumedLogo from "@/assets/consumed_logo_purple_trimmed.png";

export interface DnaShareCardProfile {
  title: string;
  superpowers: string[];
  meaning: string;
}

const WIDTH = 1080;
const HEIGHT = 1920;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawDnaIcon(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const gradient = ctx.createLinearGradient(centerX - 70, centerY - 70, centerX + 70, centerY + 70);
  gradient.addColorStop(0, "#8b5cf6");
  gradient.addColorStop(1, "#ec4899");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 72, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    for (let y = -34; y <= 34; y += 3) {
      const x = side * Math.sin((y + 34) / 17) * 22;
      if (y === -34) ctx.moveTo(centerX + x, centerY + y);
      else ctx.lineTo(centerX + x, centerY + y);
    }
    ctx.stroke();
  }
  for (let y = -27; y <= 27; y += 18) {
    const x = Math.sin((y + 34) / 17) * 22;
    ctx.beginPath();
    ctx.moveTo(centerX - x, centerY + y);
    ctx.lineTo(centerX + x, centerY + y);
    ctx.stroke();
  }
}

function drawCenteredPills(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  startY: number,
): number {
  const pills = labels.slice(0, 3);
  if (!pills.length) return startY;

  ctx.font = "600 31px Poppins, -apple-system, 'Segoe UI', sans-serif";
  const horizontalPadding = 30;
  const gap = 18;
  const pillHeight = 66;
  const widths = pills.map((label) => ctx.measureText(label).width + horizontalPadding * 2);
  const rows: { label: string; width: number }[][] = [[]];
  let rowWidth = 0;

  pills.forEach((label, index) => {
    const width = widths[index];
    if (rowWidth && rowWidth + gap + width > 880) {
      rows.push([]);
      rowWidth = 0;
    }
    rows[rows.length - 1].push({ label, width });
    rowWidth += (rowWidth ? gap : 0) + width;
  });

  rows.forEach((row, rowIndex) => {
    const totalWidth = row.reduce((sum, pill) => sum + pill.width, 0) + gap * (row.length - 1);
    let x = (WIDTH - totalWidth) / 2;
    const y = startY + rowIndex * (pillHeight + 16);
    row.forEach((pill) => {
      roundedRect(ctx, x, y, pill.width, pillHeight, pillHeight / 2);
      ctx.fillStyle = "#f5f0ff";
      ctx.fill();
      ctx.strokeStyle = "#e7d9ff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#6d28d9";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pill.label, x + pill.width / 2, y + pillHeight / 2 + 1);
      x += pill.width + gap;
    });
  });

  return startY + rows.length * (pillHeight + 16);
}

export async function renderDnaShareCard(profile: DnaShareCardProfile): Promise<Blob | null> {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  try {
    await Promise.all([
      document.fonts.load("600 31px Poppins"),
      document.fonts.load("500 38px Poppins"),
      document.fonts.load("600 42px Poppins"),
      document.fonts.load("500 74px Georgia"),
    ]);
  } catch {
    // System fonts remain a safe fallback.
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const logo = await loadImage(consumedLogo);
  if (logo) {
    const logoWidth = 360;
    const logoHeight = logoWidth * (logo.height / logo.width);
    ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 95, logoWidth, logoHeight);
  }

  drawDnaIcon(ctx, WIDTH / 2, 330);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#6d28d9";
  ctx.font = "500 27px Poppins, -apple-system, 'Segoe UI', sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText("YOUR ENTERTAINMENT DNA", WIDTH / 2, 465);
  ctx.letterSpacing = "0px";

  const titleGradient = ctx.createLinearGradient(180, 0, 900, 0);
  titleGradient.addColorStop(0, "#2e1065");
  titleGradient.addColorStop(1, "#6d28d9");
  ctx.fillStyle = titleGradient;
  ctx.font = "500 74px Georgia, 'Times New Roman', serif";
  const titleLines = wrapText(ctx, profile.title, 850);
  let y = 565;
  titleLines.forEach((line) => {
    ctx.fillText(line, WIDTH / 2, y);
    y += 84;
  });

  y = drawCenteredPills(ctx, profile.superpowers, y + 12) + 28;

  const panelX = 80;
  const panelWidth = WIDTH - panelX * 2;
  const panelBottom = HEIGHT - 190;
  roundedRect(ctx, panelX, y, panelWidth, panelBottom - y, 42);
  const panelGradient = ctx.createLinearGradient(panelX, y, panelX + panelWidth, panelBottom);
  panelGradient.addColorStop(0, "#f5f3ff");
  panelGradient.addColorStop(1, "#faf5ff");
  ctx.fillStyle = panelGradient;
  ctx.fill();

  const textX = panelX + 58;
  const textWidth = panelWidth - 116;
  let textY = y + 82;
  ctx.textAlign = "left";
  ctx.fillStyle = "#1f2937";
  ctx.font = "600 39px Poppins, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("Your Entertainment DNA Profile", textX, textY);
  textY += 72;

  ctx.font = "400 34px Poppins, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#374151";
  const paragraphLines = wrapText(ctx, profile.meaning, textWidth);
  const availableHeight = panelBottom - textY - 55;
  const lineHeight = Math.min(52, Math.max(40, availableHeight / Math.max(paragraphLines.length, 1)));
  paragraphLines.forEach((line) => {
    ctx.fillText(line, textX, textY);
    textY += lineHeight;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#7c3aed";
  ctx.font = "600 34px Poppins, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("@consumedapp", WIDTH / 2, HEIGHT - 88);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}