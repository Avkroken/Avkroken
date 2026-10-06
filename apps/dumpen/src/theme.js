export const DEFAULT_THEME = "legacy";

export function themeCss() {
  return `:root{
    color-scheme:dark;
    --bg:#060908;--bg-deep:#030504;--panel:#0b100e;--panel-2:#111915;
    --surface:#0d1310;--surface-raised:#121a16;--surface-control:#0a0f0d;
    --line:rgba(203,226,211,.11);--line-strong:rgba(203,226,211,.22);
    --text:#f2f6f3;--muted:#91a098;--subtle:#c9d5ce;
    --control-bg:#dff4e5;--control-text:#07110b;
    --accent:#74f04a;--accent-2:#45c92a;--secondary:#9b7cff;--danger:#ff7373;
    --green:var(--accent);--green2:var(--accent-2);--purple:var(--secondary);
    --glow:rgba(116,240,74,.16);
    --shadow-sm:0 10px 30px rgba(0,0,0,.18);
    --shadow-md:0 18px 48px rgba(0,0,0,.26);
    --shadow-lg:0 30px 90px rgba(0,0,0,.34)
  }
  :root[data-theme="forest"]{
    --bg:#08100b;--bg-deep:#040806;--panel:#0d1710;--panel-2:#132019;
    --surface:#101a13;--surface-raised:#17231a;--surface-control:#0b130e;
    --line:rgba(181,213,190,.12);--line-strong:rgba(181,213,190,.25);
    --text:#f1f6f2;--muted:#98aa9d;--subtle:#d4dfd6;
    --control-bg:#dce9df;--control-text:#0a120c;
    --accent:#6fe34a;--accent-2:#3dbb2b;--secondary:#78b895;
    --glow:rgba(111,227,74,.14)
  }
  :root[data-theme="blackout"]{
    --bg:#000;--bg-deep:#000;--panel:#060706;--panel-2:#0b0d0c;
    --surface:#090b0a;--surface-raised:#101210;--surface-control:#050605;
    --line:rgba(255,255,255,.08);--line-strong:rgba(255,255,255,.18);
    --text:#f6f7f6;--muted:#9d9f9e;--subtle:#d8d9d8;
    --control-bg:#e4e5e4;--control-text:#070807;
    --accent:#74f04a;--accent-2:#45c92a;--secondary:#9d9d9d;
    --glow:rgba(116,240,74,.10)
  }
  body{
    background:
      radial-gradient(900px 520px at 8% -8%,color-mix(in srgb,var(--green) 10%,transparent),transparent 60%),
      radial-gradient(800px 500px at 100% 4%,color-mix(in srgb,var(--secondary) 8%,transparent),transparent 62%),
      linear-gradient(180deg,var(--bg) 0%,var(--bg-deep) 100%)
  }
  body::before{
    content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.22;
    background-image:
      linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
    background-size:64px 64px;
    mask-image:linear-gradient(to bottom,#000 0%,rgba(0,0,0,.65) 45%,transparent 88%)
  }
  .theme-control{display:grid;gap:4px;color:var(--muted);font-size:10px;font-weight:750;letter-spacing:.075em;text-transform:uppercase}
  .theme-control select{
    min-width:124px;min-height:40px;border:1px solid var(--line);border-radius:10px;
    padding:8px 34px 8px 10px;background:var(--surface-control);color:var(--text);
    font-family:inherit;font-size:13px;text-transform:none;letter-spacing:normal
  }
  @media(max-width:680px){
    .theme-control span{display:none}
    .theme-control select{min-width:112px;min-height:44px;font-size:16px}
  }`;
}

export function themeControl() {
  return `<label class="theme-control" for="theme-select"><span>Tema</span><select id="theme-select" aria-label="Tema"><option value="legacy">Aurora</option><option value="forest">Avkroken</option><option value="blackout">Blackout</option></select></label>`;
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
