(() => {
  const state = { assets: [] };
  const list = document.querySelector("#asset-list");
  const count = document.querySelector("#asset-count");
  const status = document.querySelector("#admin-status");
  const filter = document.querySelector("#asset-filter");
  const sort = document.querySelector("#asset-sort");
  const previewPanel = document.querySelector("#preview-panel");
  const previewImage = document.querySelector("#logo-preview");
  const previewCaption = document.querySelector("#preview-caption");
  const verificationButton = document.querySelector("#run-admin-verification");
  const verificationSteps = document.querySelector("#verification-steps");

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(error));
  }

  async function adminFetch(path = "", options = {}) {
    return fetch(`/api/admin/logos${path}`, {
      ...options,
      headers: { ...(options.headers || {}) },
      cache: "no-store"
    });
  }

  async function api(path = "", options = {}) {
    const response = await adminFetch(path, options);
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({ error: "invalid_response" }));
    if (!response.ok) throw new Error(payload.error || `request_failed_${response.status}`);
    return payload;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }

  function formatDate(value) {
    const date = new Date(value || "");
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "—";
  }

  function element(tag, attributes = {}, text = null) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "className") node.className = value;
      else node.setAttribute(key, value);
    }
    if (text !== null) node.textContent = text;
    return node;
  }

  function metadataItem(label, value) {
    const wrapper = element("div");
    wrapper.append(element("dt", {}, label), element("dd", {}, value));
    return wrapper;
  }

  async function copyPublicUrl(asset) {
    const absolute = new URL(asset.publicUrl, location.origin).href;
    await navigator.clipboard.writeText(absolute);
    setStatus(`Publik URL kopierad för ${asset.originalName}.`);
  }

  function showPreview(asset) {
    previewImage.src = asset.publicUrl;
    previewImage.alt = `Förhandsvisning av ${asset.originalName}`;
    previewCaption.textContent = `${asset.originalName} · ${asset.contentType}`;
    previewPanel.hidden = false;
    document.querySelector("#preview-title").focus({ preventScroll: true });
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function replaceAsset(asset, input) {
    const file = input.files?.[0];
    if (!file) {
      setStatus("Välj en fil att ersätta med.", true);
      return;
    }
    setStatus(`Ersätter ${asset.originalName}…`);
    await api(`/${asset.id}`, {
      method: "PUT",
      headers: { "Content-Type": file.type, "X-File-Name": file.name },
      body: file
    });
    await loadAssets();
    setStatus(`Logotypen ersattes. Publik URL och asset-id är oförändrade.`);
  }

  async function deleteAsset(asset) {
    if (!window.confirm(`Ta bort ${asset.originalName}? Den publika URL:en slutar fungera.`)) return;
    setStatus(`Tar bort ${asset.originalName}…`);
    await api(`/${asset.id}`, { method: "DELETE" });
    await loadAssets();
    setStatus(`${asset.originalName} togs bort.`);
  }

  function assetCard(asset) {
    const article = element("article", { className: "asset-card" });
    const thumbnail = element("div", { className: "asset-thumbnail" });
    thumbnail.append(element("img", { src: asset.publicUrl, alt: "" }));

    const details = element("div", { className: "asset-details" });
    details.append(element("h3", {}, asset.originalName));
    const meta = element("dl", { className: "asset-meta" });
    meta.append(
      metadataItem("Asset-id", asset.id),
      metadataItem("MIME", asset.contentType || "—"),
      metadataItem("Storlek", formatBytes(asset.size)),
      metadataItem("Skapad", formatDate(asset.createdAt)),
      metadataItem("Ändrad", formatDate(asset.updatedAt)),
      metadataItem("ETag", asset.etag || "—")
    );
    details.append(meta);

    const actions = element("div", { className: "asset-actions" });
    const preview = element("button", { type: "button", className: "secondary-button" }, "Förhandsvisa");
    preview.addEventListener("click", () => showPreview(asset));
    const copy = element("button", { type: "button", className: "secondary-button" }, "Kopiera publik URL");
    copy.addEventListener("click", () => copyPublicUrl(asset).catch(error => setStatus(error.message, true)));
    const download = element("a", { className: "download-link secondary-button", href: `/api/admin/logos/${asset.id}/download` }, "Ladda ner");

    const replaceControl = element("div", { className: "replace-control" });
    const replaceId = `replace-${asset.id}`;
    const replaceLabel = element("label", { for: replaceId }, "Ersätt fil");
    const replaceInput = element("input", {
      id: replaceId,
      type: "file",
      accept: "image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
    });
    const replaceButton = element("button", { type: "button", className: "secondary-button" }, "Ersätt");
    replaceButton.addEventListener("click", () => replaceAsset(asset, replaceInput).catch(error => setStatus(error.message, true)));
    replaceControl.append(replaceLabel, replaceInput, replaceButton);

    const remove = element("button", { type: "button", className: "danger-button" }, "Ta bort");
    remove.addEventListener("click", () => deleteAsset(asset).catch(error => setStatus(error.message, true)));
    actions.append(preview, copy, download, replaceControl, remove);
    details.append(actions);
    article.append(thumbnail, details);
    return article;
  }

  function visibleAssets() {
    const query = filter.value.trim().toLocaleLowerCase("sv");
    const assets = state.assets.filter(asset =>
      !query || [asset.originalName, asset.id, asset.contentType].some(value =>
        String(value || "").toLocaleLowerCase("sv").includes(query)
      )
    );
    const mode = sort.value;
    return assets.sort((left, right) => {
      if (mode === "name-asc") return left.originalName.localeCompare(right.originalName, "sv");
      if (mode === "size-desc") return right.size - left.size;
      if (mode === "created-desc") return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }

  function renderAssets() {
    const assets = visibleAssets();
    list.replaceChildren();
    count.textContent = `${assets.length} av ${state.assets.length} assets`;
    if (!assets.length) {
      list.append(element("div", { className: "admin-empty" }, state.assets.length ? "Inga matchande assets." : "Inga logotyper är uppladdade ännu."));
    } else {
      list.append(...assets.map(assetCard));
    }
    list.setAttribute("aria-busy", "false");
  }

  async function loadAssets() {
    list.setAttribute("aria-busy", "true");
    const payload = await api();
    state.assets = Array.isArray(payload.assets) ? payload.assets : [];
    renderAssets();
  }

  function verificationSvg(marker) {
    return new Blob([
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>${marker}</title><rect width="16" height="16" rx="3" fill="#111"/><path d="M4 11V5h2v2h4V5h2v6h-2V9H6v2z" fill="#fff"/></svg>`
    ], { type: "image/svg+xml" });
  }

  function addVerificationStep(label, detail = "") {
    const item = element("li", { className: "verification-step is-success" });
    item.append(element("strong", {}, label));
    if (detail) item.append(element("span", {}, detail));
    verificationSteps.append(item);
  }

  function expectedStatus(response, status, label) {
    if (response.status !== status) {
      throw new Error(`${label}: HTTP ${response.status}`);
    }
  }

  async function verifyPublicAsset(publicUrl, marker) {
    const separator = publicUrl.includes("?") ? "&" : "?";
    const response = await fetch(
      `${publicUrl}${separator}verification=${encodeURIComponent(marker)}-${Date.now()}`,
      { cache: "no-store" }
    );
    expectedStatus(response, 200, "Publik läsning");
    if (!String(response.headers.get("content-type") || "").startsWith("image/svg+xml")) {
      throw new Error("Publik läsning: oväntad MIME-typ");
    }
    if (!(await response.text()).includes(`<title>${marker}</title>`)) {
      throw new Error("Publik läsning: fel canary-innehåll");
    }
  }

  async function runAdminVerification() {
    verificationButton.disabled = true;
    verificationSteps.replaceChildren();
    let assetId = null;
    let deleted = false;
    let primaryError = null;
    let cleanupError = null;

    try {
      setStatus("Verifierar upload…");
      const created = await api("", {
        method: "POST",
        headers: {
          "Content-Type": "image/svg+xml",
          "X-File-Name": "__avkroken_logo_admin_canary__created.svg"
        },
        body: verificationSvg("portal-admin-canary-created")
      });
      assetId = created?.asset?.id || null;
      if (created?.status !== "created" || !assetId || !created.asset.publicUrl) {
        throw new Error("Upload: ogiltigt svar");
      }
      addVerificationStep("Upload", `asset-id ${assetId}`);

      const listing = await api();
      if (!listing.assets?.some(asset => asset.id === assetId)) {
        throw new Error("Listning: testasset saknas");
      }
      addVerificationStep("Listning", "Testasset hittades i adminlistan.");

      const metadata = await api(`/${assetId}`);
      if (metadata?.asset?.id !== assetId) throw new Error("Metadata: fel asset-id");
      addVerificationStep("Metadata", "Stabilt asset-id verifierat.");

      await verifyPublicAsset(created.asset.publicUrl, "portal-admin-canary-created");
      addVerificationStep("Publik URL", "Canaryn kunde läsas via public read-boundary.");

      setStatus("Verifierar replace…");
      const replaced = await api(`/${assetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "image/svg+xml",
          "X-File-Name": "__avkroken_logo_admin_canary__replaced.svg"
        },
        body: verificationSvg("portal-admin-canary-replaced")
      });
      if (replaced?.status !== "updated" || replaced.asset?.id !== assetId) {
        throw new Error("Replace: asset-id ändrades");
      }
      await verifyPublicAsset(replaced.asset.publicUrl, "portal-admin-canary-replaced");
      addVerificationStep("Replace", "Samma asset-id och uppdaterat publikt innehåll.");

      const downloaded = await adminFetch(`/${assetId}/download`);
      expectedStatus(downloaded, 200, "Download");
      if (!String(downloaded.headers.get("content-disposition") || "").includes("attachment")) {
        throw new Error("Download: Content-Disposition saknas");
      }
      if (!(await downloaded.text()).includes("<title>portal-admin-canary-replaced</title>")) {
        throw new Error("Download: fel innehåll");
      }
      addVerificationStep("Download", "Admin-download returnerade ersatt fil.");

      const removed = await adminFetch(`/${assetId}`, { method: "DELETE" });
      expectedStatus(removed, 204, "Delete");
      deleted = true;
      addVerificationStep("Delete", "Testasset raderades.");

      const missing = await adminFetch(`/${assetId}`);
      expectedStatus(missing, 404, "Raderingskontroll");
      addVerificationStep("Raderingskontroll", "Metadata är borta efter delete.");
      setStatus("Verifiering klar: upload, listning, publik läsning, replace, download och delete fungerar.");
    } catch (error) {
      primaryError = error;
      const item = element("li", { className: "verification-step is-error" });
      item.append(element("strong", {}, "Verifiering avbruten"), element("span", {}, error.message));
      verificationSteps.append(item);
    } finally {
      if (assetId && !deleted) {
        try {
          const cleanup = await adminFetch(`/${assetId}`, { method: "DELETE" });
          if (cleanup.status !== 204 && cleanup.status !== 404) {
            throw new Error(`HTTP ${cleanup.status}`);
          }
          addVerificationStep("Automatisk städning", "Tillfällig testasset togs bort.");
        } catch (error) {
          cleanupError = error;
        }
      }

      await loadAssets().catch(() => {});
      verificationButton.disabled = false;

      if (cleanupError) {
        setStatus(`Verifieringen misslyckades och testasset kunde inte städas: ${cleanupError.message}`, true);
      } else if (primaryError) {
        setStatus(`Verifieringen misslyckades: ${primaryError.message}`, true);
      }
    }
  }

  document.querySelector("#logo-upload-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.querySelector("#logo-file");
    const file = input.files?.[0];
    if (!file) return;
    try {
      setStatus(`Laddar upp ${file.name}…`);
      await api("", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file
      });
      input.value = "";
      await loadAssets();
      setStatus(`${file.name} laddades upp.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  verificationButton.addEventListener("click", () => {
    runAdminVerification().catch(error => setStatus(error.message, true));
  });
  document.querySelector("#refresh-assets").addEventListener("click", () => {
    loadAssets().then(() => setStatus("Listan uppdaterades.")).catch(error => setStatus(error.message, true));
  });
  document.querySelector("#close-preview").addEventListener("click", () => {
    previewPanel.hidden = true;
    previewImage.removeAttribute("src");
    document.querySelector("#assets-title").focus({ preventScroll: true });
  });
  filter.addEventListener("input", renderAssets);
  sort.addEventListener("change", renderAssets);

  loadAssets().catch(error => {
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(element("div", { className: "admin-empty" }, "Logotyperna kunde inte läsas."));
    setStatus(error.message, true);
  });
})();
