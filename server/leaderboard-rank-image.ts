import fs from "fs";
import path from "path";
import sharp from "sharp";
import { verifyLeaderboardShareToken } from "./leaderboard-share";

type ArtworkAssets = {
  logo: string;
  regular: string;
  semibold: string;
  bold: string;
};

let artworkAssets: ArtworkAssets | null = null;

function fileData(...segments: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), ...segments)).toString("base64");
}

function loadArtworkAssets(): ArtworkAssets {
  if (artworkAssets) return artworkAssets;
  const fontPath = (weight: number) => fileData(
    "node_modules",
    "@fontsource",
    "poppins",
    "files",
    `poppins-latin-${weight}-normal.woff2`,
  );
  artworkAssets = {
    logo: fileData("client", "public", "consumed-logo-white.png"),
    regular: fontPath(400),
    semibold: fontPath(600),
    bold: fontPath(700),
  };
  return artworkAssets;
}

function leaderboardSvg(rank: number): string {
  const assets = loadArtworkAssets();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <style>
        @font-face {
          font-family: "Poppins";
          src: url(data:font/woff2;base64,${assets.regular}) format("woff2");
          font-weight: 400;
        }
        @font-face {
          font-family: "Poppins";
          src: url(data:font/woff2;base64,${assets.semibold}) format("woff2");
          font-weight: 600;
        }
        @font-face {
          font-family: "Poppins";
          src: url(data:font/woff2;base64,${assets.bold}) format("woff2");
          font-weight: 700;
        }
      </style>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#100824"/>
        <stop offset=".58" stop-color="#28105b"/>
        <stop offset="1" stop-color="#5b21b6"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a855f7"/>
        <stop offset="1" stop-color="#3b82f6"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#8b5cf6" stop-opacity=".52"/>
        <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1010" cy="205" r="330" fill="url(#glow)"/>

    <image href="data:image/png;base64,${assets.logo}" x="76" y="55" width="300" height="68" preserveAspectRatio="xMinYMid meet"/>

    <rect x="76" y="157" width="236" height="48" rx="24" fill="#ffffff" fill-opacity=".1" stroke="#ffffff" stroke-opacity=".12"/>
    <circle cx="101" cy="181" r="12" fill="url(#accent)"/>
    <text x="124" y="188" fill="#d8b4fe" font-family="Poppins,sans-serif" font-size="20" font-weight="700" letter-spacing=".7">LEADERBOARD</text>

    <text x="76" y="314" fill="#fff" font-family="Poppins" font-size="58" font-weight="700" letter-spacing="-2.2">
      <tspan x="76" dy="0">I reached #${rank}</tspan>
      <tspan x="76" dy="72">on Consumed.</tspan>
    </text>

    <g transform="translate(76 459)">
      <rect width="125" height="38" rx="19" fill="#ffffff" fill-opacity=".09"/>
      <rect x="137" width="72" height="38" rx="19" fill="#ffffff" fill-opacity=".09"/>
      <rect x="221" width="104" height="38" rx="19" fill="#ffffff" fill-opacity=".09"/>
      <rect x="337" width="104" height="38" rx="19" fill="#ffffff" fill-opacity=".09"/>
      <text x="62.5" y="26" text-anchor="middle" fill="#ddd8e8" font-family="Poppins" font-size="15" font-weight="600">MOVIES</text>
      <text x="173" y="26" text-anchor="middle" fill="#ddd8e8" font-family="Poppins" font-size="15" font-weight="600">TV</text>
      <text x="273" y="26" text-anchor="middle" fill="#ddd8e8" font-family="Poppins" font-size="15" font-weight="600">BOOKS</text>
      <text x="389" y="26" text-anchor="middle" fill="#ddd8e8" font-family="Poppins" font-size="15" font-weight="600">MUSIC</text>
    </g>
  </svg>`;
}

export async function handleLeaderboardRankImageRequest(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const token = typeof req.query?.share === "string" ? req.query.share : "";
  const share = verifyLeaderboardShareToken(token);
  if (!share) {
    return res.status(400).json({ error: "Invalid leaderboard share link" });
  }

  const png = await sharp(Buffer.from(leaderboardSvg(share.rank)))
    .png({ compressionLevel: 9 })
    .toBuffer();

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", String(png.length));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.status(200).send(png);
}