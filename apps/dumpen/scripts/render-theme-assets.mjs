import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

import { APP_THEME_APPS, APP_THEME_IDS, appThemeLabel } from "../src/app-theme-contract.js";

const SIZE = 1254;
const apps = {
  dozzle: { label: "Dozzle", accent: "#29f0d0" },
  maintainerr: { label: "Maintainerr", accent: "#8ef0a8" },
  plex: { label: "Plex", accent: "#e5a00d" },
  prowlarr: { label: "Prowlarr", accent: "#22d3ee" },
  qbittorrent: { label: "qBittorrent", accent: "#4f8cff" },
  radarr: { label: "Radarr", accent: "#ffc845" },
  sonarr: { label: "Sonarr", accent: "#38cfff" },
  tautulli: { label: "Tautulli", accent: "#f0b429" },
};

const themes = {
  1: { main: "#61f4ff", secondary: "#9d5cff", bg: "#060910" },
  2: { main: "#28e7ff", secondary: "#0aa8c7", bg: "#04101a" },
  3: { main: "#43dcff", secondary: "#1b7cff", bg: "#060b15" },
  4: { main: "#4ee6ff", secondary: "#8172ff", bg: "#07101b" },
  5: { main: "#40f58d", secondary: "#0e9f61", bg: "#03120d" },
  6: { main: "#5cff9b", secondary: "#177a50", bg: "#04100b" },
  7: { main: "#55b8ff", secondary: "#316dff", bg: "#050b19" },
};

function motif(app, color, accent) {
  const common = `fill="none" stroke="${color}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"`;
  if (app === "plex") return `
    <g filter="url(#strongGlow)">
      <path d="M525 420 L720 627 L525 834 L615 834 L810 627 L615 420 Z" fill="${accent}" stroke="${color}" stroke-width="18"/>
    </g>`;
  if (app === "dozzle") return `
    <g ${common} filter="url(#strongGlow)">
      <rect x="432" y="438" width="390" height="330" rx="54"/>
      <path d="M510 548 L594 627 L510 706"/>
      <path d="M637 706 H746"/>
    </g>`;
  if (app === "maintainerr") return `
    <g ${common} filter="url(#strongGlow)">
      <circle cx="627" cy="627" r="112"/>
      <path d="M627 454 V392 M627 862 V800 M454 627 H392 M862 627 H800
               M505 505 L461 461 M749 749 L793 793 M749 505 L793 461 M505 749 L461 793"/>
      <path d="M575 680 L690 565 M565 565 L690 690"/>
    </g>`;
  if (app === "prowlarr") return `
    <g ${common} filter="url(#strongGlow)">
      <circle cx="590" cy="590" r="154"/>
      <path d="M700 700 L820 820"/>
      <path d="M510 626 A90 90 0 0 1 650 535"/>
      <path d="M548 628 A48 48 0 0 1 625 577"/>
    </g>`;
  if (app === "qbittorrent") return `
    <g ${common} filter="url(#strongGlow)">
      <circle cx="627" cy="627" r="205"/>
      <path d="M627 485 V690"/>
      <path d="M545 622 L627 704 L709 622"/>
      <path d="M745 745 L820 820"/>
    </g>`;
  if (app === "radarr") return `
    <g ${common} filter="url(#strongGlow)">
      <circle cx="627" cy="627" r="190"/>
      <circle cx="627" cy="627" r="38" fill="${accent}"/>
      <path d="M627 627 L770 514"/>
      <path d="M492 492 A190 190 0 0 1 762 492"/>
      <path d="M470 760 H784"/>
      <path d="M510 760 V825 M570 760 V825 M630 760 V825 M690 760 V825 M750 760 V825"/>
    </g>`;
  if (app === "sonarr") return `
    <g ${common} filter="url(#strongGlow)">
      <rect x="445" y="495" width="364" height="270" rx="48"/>
      <path d="M535 820 H719"/>
      <path d="M627 495 C560 560 560 690 627 765"/>
      <path d="M627 495 C694 560 694 690 627 765"/>
      <circle cx="627" cy="627" r="34" fill="${accent}"/>
    </g>`;
  return `
    <g ${common} filter="url(#strongGlow)">
      <path d="M455 760 V650 M545 760 V560 M635 760 V610 M725 760 V485 M815 760 V585"/>
      <path d="M438 500 C520 430 590 590 665 520 C725 466 770 440 835 472"/>
      <circle cx="835" cy="472" r="24" fill="${accent}"/>
    </g>`;
}

function commonDefs(t, accent) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.bg}"/>
      <stop offset=".55" stop-color="#08111f"/>
      <stop offset="1" stop-color="#020509"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop offset="0" stop-color="${t.main}" stop-opacity=".34"/>
      <stop offset=".55" stop-color="${t.secondary}" stop-opacity=".10"/>
      <stop offset="1" stop-color="${t.bg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.main}"/>
      <stop offset=".55" stop-color="${accent}"/>
      <stop offset="1" stop-color="${t.secondary}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="strongGlow"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
}

function base(t, accent) {
  return `
    <rect width="1254" height="1254" fill="#010306"/>
    <rect x="58" y="58" width="1138" height="1138" rx="230" fill="url(#bg)" stroke="url(#rim)" stroke-width="9"/>
    <circle cx="627" cy="627" r="470" fill="url(#halo)"/>
    <path d="M205 220 C450 95 825 95 1050 230" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="30"/>
  `;
}

function themeDecor(id, t, accent) {
  if (id === 1) return `
    <rect x="176" y="176" width="902" height="902" rx="190" fill="#fff" fill-opacity=".028" stroke="${t.main}" stroke-opacity=".28" stroke-width="3"/>
    <path d="M230 340 H1024 M230 914 H1024" stroke="${t.secondary}" stroke-opacity=".18" stroke-width="3"/>
    <circle cx="627" cy="627" r="300" fill="none" stroke="${t.main}" stroke-opacity=".16" stroke-width="4"/>`;
  if (id === 2) {
    let grid = "";
    for (let p = 230; p <= 1024; p += 88) grid += `<path d="M${p} 200 V1054 M200 ${p} H1054" stroke="${t.main}" stroke-opacity=".055" stroke-width="2"/>`;
    return `
      ${grid}
      <circle cx="627" cy="627" r="334" fill="none" stroke="${t.main}" stroke-opacity=".34" stroke-width="5"/>
      <circle cx="627" cy="627" r="272" fill="none" stroke="${t.main}" stroke-opacity=".16" stroke-width="3" stroke-dasharray="18 24"/>
      <path d="M255 344 H410 V250 M999 344 H844 V250 M255 910 H410 V1004 M999 910 H844 V1004" fill="none" stroke="${t.main}" stroke-opacity=".72" stroke-width="7"/>
      <path d="M627 245 V330 M627 924 V1009 M245 627 H330 M924 627 H1009" stroke="${t.main}" stroke-opacity=".48" stroke-width="5"/>
      <g fill="${accent}" opacity=".72"><circle cx="332" cy="332" r="11"/><circle cx="922" cy="332" r="11"/><circle cx="332" cy="922" r="11"/><circle cx="922" cy="922" r="11"/></g>`;
  }
  if (id === 3) return `
    <polygon points="306,752 627,566 948,752 627,938" fill="#0b1a2c" stroke="${t.main}" stroke-opacity=".46" stroke-width="6"/>
    <polygon points="336,720 627,552 918,720 627,888" fill="#102c48" fill-opacity=".7"/>
    <g stroke="${t.main}" stroke-opacity=".36" stroke-width="8" fill="none">
      <path d="M332 855 L452 925 L332 995 L212 925 Z"/>
      <path d="M802 875 H1007 V1002 H802 Z"/>
      <path d="M840 910 H970 M840 946 H930"/>
    </g>
    <circle cx="627" cy="500" r="260" fill="url(#halo)" opacity=".82"/>`;
  if (id === 4) return `
    <path d="M126 873 C280 710 410 806 540 710 C690 598 820 700 1128 555 V1120 H126 Z" fill="${t.secondary}" fill-opacity=".16"/>
    <path d="M126 956 C318 820 470 920 646 802 C804 696 951 782 1128 700 V1120 H126 Z" fill="${t.main}" fill-opacity=".11"/>
    <circle cx="930" cy="318" r="104" fill="${accent}" fill-opacity=".22" filter="url(#glow)"/>
    <g fill="${t.main}" opacity=".25"><circle cx="248" cy="346" r="16"/><circle cx="1008" cy="472" r="12"/><circle cx="332" cy="542" r="9"/></g>`;
  if (id === 5) return `
    <g fill="none" stroke="${t.main}">
      <circle cx="627" cy="627" r="382" stroke-opacity=".36" stroke-width="5"/>
      <circle cx="627" cy="627" r="292" stroke-opacity=".28" stroke-width="4"/>
      <circle cx="627" cy="627" r="202" stroke-opacity=".22" stroke-width="3"/>
      <path d="M627 627 L932 398" stroke-opacity=".78" stroke-width="14" filter="url(#glow)"/>
      <path d="M627 235 V1019 M235 627 H1019" stroke-opacity=".12" stroke-width="3"/>
    </g>
    <path d="M627 627 L939 393 A390 390 0 0 1 1008 544 Z" fill="${t.main}" fill-opacity=".09"/>
    <g fill="${accent}" filter="url(#glow)"><circle cx="828" cy="476" r="13"/><circle cx="410" cy="720" r="10"/><circle cx="768" cy="810" r="9"/></g>`;
  if (id === 6) return `
    <polygon points="627,268 894,422 894,730 627,884 360,730 360,422" fill="${t.main}" fill-opacity=".055" stroke="${t.main}" stroke-opacity=".32" stroke-width="6"/>
    <polygon points="627,354 820,466 820,690 627,802 434,690 434,466" fill="none" stroke="${t.main}" stroke-opacity=".19" stroke-width="4"/>
    <circle cx="627" cy="627" r="260" fill="url(#halo)"/>
    <circle cx="627" cy="627" r="126" fill="${t.main}" fill-opacity=".08" stroke="${t.main}" stroke-opacity=".48" stroke-width="5" filter="url(#glow)"/>`;
  return `
    <g fill="none" stroke="${t.main}">
      <ellipse cx="627" cy="627" rx="410" ry="190" transform="rotate(-22 627 627)" stroke-opacity=".34" stroke-width="6"/>
      <ellipse cx="627" cy="627" rx="348" ry="148" transform="rotate(34 627 627)" stroke-opacity=".22" stroke-width="4"/>
      <circle cx="627" cy="627" r="284" stroke-opacity=".12" stroke-width="3" stroke-dasharray="12 24"/>
    </g>
    <g fill="${accent}" filter="url(#glow)"><circle cx="964" cy="440" r="18"/><circle cx="324" cy="794" r="15"/><circle cx="795" cy="878" r="11"/></g>`;
}

async function render(app, themeId, out) {
  const a = apps[app];
  const t = themes[themeId];
  if (!a || !t) throw new Error("Unknown app/theme");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    ${commonDefs(t, a.accent)}
    ${base(t, a.accent)}
    ${themeDecor(themeId, t, a.accent)}
    ${motif(app, t.main, a.accent)}
    <rect x="58" y="58" width="1138" height="1138" rx="230" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
  </svg>`;
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  const m = await sharp(out).metadata();
  return { app, themeId, theme: appThemeLabel(themeId), out, width: m.width, height: m.height, format: m.format };
}

const workRoot = path.resolve(process.env.DUMPEN_ASSET_WORK || ".asset-work");
const sourceRoot = path.join(workRoot, "source");
const rendered = [];

for (const app of APP_THEME_APPS) {
  for (const themeId of APP_THEME_IDS) {
    rendered.push(await render(
      app,
      themeId,
      path.join(sourceRoot, app + "-" + themeId + ".png"),
    ));
  }
}

console.log(JSON.stringify({
  originals: rendered.length,
  sourceSize: SIZE,
  sourceRoot,
  themes: APP_THEME_IDS.map((themeId) => ({
    id: themeId,
    label: appThemeLabel(themeId),
  })),
}, null, 2));
