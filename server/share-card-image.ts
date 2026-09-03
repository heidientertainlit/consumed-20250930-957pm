import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export type ShareCardKind =
  | "invite"
  | "profile"
  | "challenge"
  | "post"
  | "media"
  | "tribe"
  | "list"
  | "ranking"
  | "dna"
  | "leaderboard"
  | "play"
  | "general";

type ShareCardPayload = {
  version: 1;
  kind: ShareCardKind;
  eyebrow: string;
  title: string;
  description: string;
};

type ArtworkAssets = {
  logo: string;
  regular: string;
  semibold: string;
  bold: string;
};

let artworkAssets: ArtworkAssets | null = null;

function signingSecret(): string {
  return process.env.SESSION_SECRET || "";
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", signingSecret()).update(encodedPayload).digest("base64url");
}

function compact(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fileData(...segments: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...segments)).toString("base64");
}

function loadArtworkAssets(): ArtworkAssets {
  if (artworkAssets) return artworkAssets;
  artworkAssets = {
    logo: fileData("client", "public", "consumed-logo-white.png"),
    regular: fileData("server", "assets", "Poppins-Regular.ttf"),
    semibold: fileData("server", "assets", "Poppins-SemiBold.ttf"),
    bold: fileData("server", "assets", "Poppins-Bold.ttf"),
  };
  return artworkAssets;
}

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current) {
      lines.push(word);
    } else if (`${current} ${word}`.length <= maxCharacters) {
      lines[lines.length - 1] = `${current} ${word}`;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[maxLines - 1] = compact(`${lines[maxLines - 1]} ${word}`, maxCharacters);
    }
  }
  return lines.slice(0, maxLines);
}

function visualSvg(kind: ShareCardKind): string {
  if (kind === "play" || kind === "challenge") {
    return `
      <circle cx="930" cy="243" r="104" fill="none" stroke="#c084fc" stroke-width="5"/>
      <path d="M878 226q16-18 32 0M950 226q16-18 32 0M880 270q50 44 100 0" fill="none" stroke="#d8b4fe" stroke-width="14" stroke-linecap="round"/>`;
  }
  if (kind === "dna" || kind === "profile") {
    return `
      <path d="M862 150c104 45 104 141 0 186M998 150c-104 45-104 141 0 186M879 178h102M862 242h136M879 307h102" fill="none" stroke="#c084fc" stroke-width="8" stroke-linecap="round" opacity=".9"/>`;
  }
  if (kind === "tribe" || kind === "invite") {
    return `
      <circle cx="930" cy="205" r="46" fill="none" stroke="#c084fc" stroke-width="8"/>
      <circle cx="855" cy="233" r="32" fill="none" stroke="#8b5cf6" stroke-width="7"/>
      <circle cx="1005" cy="233" r="32" fill="none" stroke="#8b5cf6" stroke-width="7"/>
      <path d="M856 323c8-42 35-64 74-64s66 22 74 64M803 318c6-30 24-47 52-47M1005 271c28 0 46 17 52 47" fill="none" stroke="#c084fc" stroke-width="8" stroke-linecap="round"/>`;
  }
  if (kind === "media" || kind === "post" || kind === "list" || kind === "ranking") {
    return `
      <rect x="839" y="152" width="126" height="176" rx="17" fill="none" stroke="#8b5cf6" stroke-width="8" transform="rotate(-9 902 240)"/>
      <rect x="899" y="151" width="126" height="176" rx="17" fill="#28105b" stroke="#c084fc" stroke-width="8" transform="rotate(8 962 239)"/>
      <path d="M927 279l27-31 22 21 21-26" fill="none" stroke="#60a5fa" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return "";
}

function renderShareCardSvg(payload: ShareCardPayload): string {
  const assets = loadArtworkAssets();
  const titleLines = wrapText(payload.title, 25, 3);
  const titleFontSize = titleLines.length === 3 ? 46 : 52;
  const titleLineHeight = titleFontSize + 10;
  const isPlayCard = payload.kind === "play";
  const titleY = isPlayCard ? 184 : 220;
  const titleTspans = titleLines
    .map((line, index) => `<tspan x="58" dy="${index === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
  const descriptionY = titleY + (titleLines.length - 1) * titleLineHeight + 58;
  const showVisual = payload.kind !== "leaderboard" && titleLines.join(" ").length < 55;
  const description = compact(payload.description, showVisual ? 46 : 66);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <style>
        @font-face { font-family: "Poppins"; src: url(data:font/ttf;base64,${assets.regular}) format("truetype"); font-weight: 400; }
        @font-face { font-family: "Poppins"; src: url(data:font/ttf;base64,${assets.semibold}) format("truetype"); font-weight: 600; }
        @font-face { font-family: "Poppins"; src: url(data:font/ttf;base64,${assets.bold}) format("truetype"); font-weight: 700; }
      </style>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#070817"/>
        <stop offset=".66" stop-color="#11112a"/>
        <stop offset="1" stop-color="#1d103a"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a855f7"/>
        <stop offset="1" stop-color="#3b82f6"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#7c3aed" stop-opacity=".24"/>
        <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="1200" height="630" rx="30" fill="url(#bg)"/>
    <circle cx="940" cy="220" r="330" fill="url(#glow)"/>
    <image href="data:image/png;base64,${assets.logo}" x="58" y="42" width="285" height="66" preserveAspectRatio="xMinYMid meet"/>

    ${isPlayCard ? "" : `
      <rect x="58" y="124" width="${Math.max(180, payload.eyebrow.length * 13 + 52)}" height="42" rx="21" fill="#7c3aed" fill-opacity=".14" stroke="#a855f7" stroke-opacity=".18"/>
      <circle cx="82" cy="145" r="9" fill="url(#accent)"/>
      <text x="102" y="152" fill="#d8b4fe" font-family="Poppins" font-size="17" font-weight="600" letter-spacing=".5">${escapeXml(payload.eyebrow)}</text>
    `}

    <text x="58" y="${titleY}" fill="#fff" font-family="Poppins" font-size="${titleFontSize}" font-weight="700" letter-spacing="-1.8">${titleTspans}</text>
    ${isPlayCard ? "" : `<text x="58" y="${descriptionY}" fill="#d7d2de" font-family="Poppins" font-size="24" font-weight="400">${escapeXml(description)}</text>`}
    ${showVisual ? visualSvg(payload.kind) : ""}

    <g transform="translate(58 407)">
      <rect width="134" height="38" rx="19" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
      <rect x="147" width="78" height="38" rx="19" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
      <rect x="238" width="112" height="38" rx="19" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
      <rect x="363" width="112" height="38" rx="19" fill="#ffffff" fill-opacity=".055" stroke="#ffffff" stroke-opacity=".1"/>
      <text x="67" y="25" text-anchor="middle" fill="#ede9f3" font-family="Poppins" font-size="15" font-weight="600">MOVIES</text>
      <text x="186" y="25" text-anchor="middle" fill="#ede9f3" font-family="Poppins" font-size="15" font-weight="600">TV</text>
      <text x="294" y="25" text-anchor="middle" fill="#ede9f3" font-family="Poppins" font-size="15" font-weight="600">BOOKS</text>
      <text x="419" y="25" text-anchor="middle" fill="#ede9f3" font-family="Poppins" font-size="15" font-weight="600">MUSIC</text>
    </g>

    <path d="M36 476h1128" stroke="#7c3aed" stroke-width="2" opacity=".72"/>
    <text x="58" y="535" fill="#fff" font-family="Poppins" font-size="28" font-weight="600">See what everyone’s consuming.</text>
    <text x="58" y="579" fill="#d7d2de" font-family="Poppins" font-size="22" font-weight="400">Discover your Entertainment DNA. Find your people.</text>
    <path d="M1081 548h44m-16-16 16 16-16 16" fill="none" stroke="#a855f7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function createShareCardToken(input: Omit<ShareCardPayload, "version">): string | null {
  if (!signingSecret()) return null;
  const payload: ShareCardPayload = {
    version: 1,
    kind: input.kind,
    eyebrow: compact(input.eyebrow, 28),
    title: compact(input.title, 90),
    description: compact(input.description, 120),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyShareCardToken(token: string): ShareCardPayload | null {
  if (!signingSecret()) return null;
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;
  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      payload?.version !== 1
      || typeof payload?.kind !== "string"
      || typeof payload?.eyebrow !== "string"
      || typeof payload?.title !== "string"
      || typeof payload?.description !== "string"
    ) return null;
    return payload as ShareCardPayload;
  } catch {
    return null;
  }
}

export async function handleShareCardImageRequest(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const token = typeof req.query?.token === "string" ? req.query.token : "";
  const payload = verifyShareCardToken(token);
  if (!payload) return res.status(400).json({ error: "Invalid share card" });

  const png = await sharp(Buffer.from(renderShareCardSvg(payload)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", String(png.length));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.status(200).send(png);
}