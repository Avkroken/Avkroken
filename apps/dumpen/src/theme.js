export const DEFAULT_THEME = "legacy";

export function themeCss() {
  return `:root{
    color-scheme:dark;
    --bg:#04070e;--bg-deep:#03060c;--panel:#09101e;--panel-2:#0d182c;
    --line:rgba(137,167,207,.18);--line-strong:rgba(137,167,207,.34);--text:#f5f3ee;--muted:#91a8c6;--subtle:#dce7f8;
    --control-bg:#dce7f8;--control-text:#08111c;--accent:#6ee71e;--accent-2:#42b80f;--secondary:#a66cff;--danger:#ff6b6b;
    --green:var(--accent);--green2:var(--accent-2);--purple:var(--secondary);
    --glow:#0d182c
  }
  :root[data-theme="forest"]{
    --bg:#080b09;--bg-deep:#050806;--panel:#111713;--panel-2:#171f19;
    --line:#263129;--line-strong:#3b493e;--text:#f3f5f1;--muted:#a6b1aa;--subtle:#dce2dd;
    --control-bg:#dce2dd;--control-text:#101612;--glow:#171f19
  }
  :root[data-theme="blackout"]{
    --bg:#000;--bg-deep:#030303;--panel:#070707;--panel-2:#0d0d0d;
    --line:#1a1a1a;--line-strong:#333;--text:#f6f6f3;--muted:#b5b5b5;--subtle:#dedede;
    --control-bg:#dedede;--control-text:#090909;--glow:#0d0d0d
  }
  :root[data-theme="legacy"] body{
    background:
      radial-gradient(circle at 14% 8%,rgba(36,231,232,.11),transparent 27rem),
      radial-gradient(circle at 86% 18%,rgba(213,29,203,.10),transparent 30rem),
      radial-gradient(circle at 50% 100%,rgba(45,155,255,.08),transparent 35rem),
      linear-gradient(180deg,#050912 0%,#03060c 100%)
  }
  :root[data-theme="legacy"] body::before{
    content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;
    background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
    background-size:42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 82%)
  }
  .theme-control{display:grid;gap:3px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .theme-control select{min-width:112px;border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--panel);color:var(--text);font:inherit;text-transform:none;letter-spacing:normal}`;
}

export function themeControl() {
  return `<label class="theme-control" for="theme-select"><span>Tema</span><select id="theme-select" aria-label="Tema"><option value="legacy">Legacy</option><option value="forest">Avkroken</option><option value="blackout">Blackout</option></select></label>`;
}

export function themeScript() {
  return `<script>(function(){
    const themes=new Set(["legacy","forest","blackout"]),fallback="legacy",storageKey="avkroken.theme",cookieName="avkroken_theme";
    function saved(){const entry=document.cookie.split("; ").find(v=>v.startsWith(cookieName+"="));let value=entry?entry.split("=")[1]:"";if(themes.has(value))return value;try{value=localStorage.getItem(storageKey)||""}catch{}return themes.has(value)?value:""}
    function persist(theme){try{localStorage.setItem(storageKey,theme)}catch{}const denied=location.hostname==="denied.se"||location.hostname.endsWith(".denied.se"),domain=denied?"; Domain=.denied.se":"",secure=location.protocol==="https:"?"; Secure":"";document.cookie=cookieName+"="+theme+"; Max-Age=31536000; Path=/; SameSite=Lax"+domain+secure}
    function apply(value,save){const theme=themes.has(value)?value:fallback;document.documentElement.dataset.theme=theme;const select=document.querySelector("#theme-select");if(select)select.value=theme;if(save)persist(theme)}
    const value=saved();apply(value||document.documentElement.dataset.theme||fallback,Boolean(value));
    document.querySelector("#theme-select")?.addEventListener("change",event=>apply(event.currentTarget.value,true));
  })();</script>`;
}
