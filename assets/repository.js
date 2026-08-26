(() => {
  "use strict";

  const CONFIG = {
    owner: "zwazi",
    repository: "TronnerRepository",
    branch: "main",
    refreshInterval: 5 * 60 * 1000,
    cacheKey: "tronner-repository-tree-v1"
  };

  const ICONS = {
    folder: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" stroke="currentColor" stroke-width="1.6"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 4v14m6-12v14" stroke="currentColor" stroke-width="1.6"/></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 8h14v11H5V8Zm-1-4h16v4H4V4Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.6"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5" stroke="currentColor" stroke-width="1.6"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none"><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M14 5l-4 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    cockpit: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 18V6m16 12V6M7 15l3-4 3 2 4-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 18h18" stroke="currentColor" stroke-width="1.6"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 3v5h4M9 12h6M9 16h5" stroke="currentColor" stroke-width="1.6"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg>',
    preview: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.8 12s3.3-5 9.2-5 9.2 5 9.2 5-3.3 5-9.2 5-9.2-5-9.2-5Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18v2h14v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const state = {
    items: [],
    contents: new Map(),
    currentPath: "",
    query: "",
    filter: "all",
    view: "browse",
    sort: "name",
    sortDirection: 1,
    loading: true,
    lastSync: null,
    source: "network",
    treeSha: "",
    downloading: false,
    previewCache: new Map()
  };

  const $ = selector => document.querySelector(selector);
  const elements = {
    statusPill: $("#status-pill"),
    statusText: $("#status-text"),
    syncCaption: $("#sync-caption"),
    searchInput: $("#search-input"),
    clearSearch: $("#clear-search"),
    mapCount: $("#map-count"),
    fileCount: $("#file-count"),
    folderCount: $("#folder-count"),
    repoSize: $("#repo-size"),
    errorBanner: $("#error-banner"),
    errorMessage: $("#error-message"),
    directoryTree: $("#directory-tree"),
    directoryCount: $("#directory-count"),
    breadcrumbs: $("#breadcrumbs"),
    fileRows: $("#file-rows"),
    emptyState: $("#empty-state"),
    resultSummary: $("#result-summary"),
    refreshButton: $("#refresh-button"),
    lastUpdated: $("#last-updated"),
    toast: $("#toast"),
    githubLink: $("#github-link"),
    downloadAllLink: $("#download-all-link"),
    directoryDownloadButton: $("#directory-download-button"),
    directoryDownloadLabel: $("#directory-download-label"),
    previewDialog: $("#preview-dialog"),
    previewTitle: $("#preview-title"),
    previewMeta: $("#preview-meta"),
    previewStage: $("#preview-stage"),
    previewSvg: $("#map-preview"),
    previewLoading: $("#preview-loading"),
    previewClose: $("#preview-close"),
    previewRawLink: $("#preview-raw-link")
  };

  const repositoryUrl = `https://github.com/${CONFIG.owner}/${CONFIG.repository}`;
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repository}/git/trees/${encodeURIComponent(CONFIG.branch)}?recursive=1`;
  const archiveUrl = `${repositoryUrl}/archive/refs/heads/${encodeURIComponent(CONFIG.branch)}.zip`;
  elements.githubLink.href = repositoryUrl;
  elements.downloadAllLink.href = archiveUrl;

  const basename = path => path.split("/").pop() || path;
  const parentPath = path => path.split("/").slice(0, -1).join("/");
  const encodePath = path => path.split("/").map(encodeURIComponent).join("/");
  const rawFileUrl = path => `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repository}/${encodeURIComponent(CONFIG.branch)}/${encodePath(path)}`;

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 || value >= 10 ? 0 : 1)} ${units[index]}`;
  }

  function relativeTime(date) {
    if (!date) return "not yet synced";
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }

  function fileKind(item) {
    if (item.type === "tree") return "folder";
    const path = item.path.toLowerCase();
    if (path.endsWith(".aacockpit.xml") || (path.includes("/cockpits/") && path.endsWith(".aamap.xml"))) return "cockpit";
    if (path.endsWith(".aamap.xml")) return "map";
    if (/\.(zip|7z|tar|gz)$/.test(path)) return "archive";
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(path)) return "image";
    if (/\.(html?|css|js|mjs|py|php|cfg|dtd|json|ya?ml|toml|sh)$/.test(path)) return "code";
    return "file";
  }

  function typeLabel(item) {
    const kind = fileKind(item);
    if (kind === "folder") return "Folder";
    if (kind === "map") return "AAMap";
    if (kind === "cockpit") return "Cockpit";
    if (kind === "archive") return "Archive";
    if (kind === "image") return "Image";
    const name = basename(item.path);
    return name.includes(".") ? name.split(".").pop().toUpperCase() : "File";
  }

  function normalizeTree(tree) {
    return tree
      .filter(item => item && typeof item.path === "string" && ["blob", "tree"].includes(item.type))
      .map(item => ({
        path: item.path,
        type: item.type,
        size: Number.isFinite(item.size) ? item.size : 0,
        sha: item.sha || ""
      }));
  }

  function buildIndex(items) {
    state.contents = new Map([["", []]]);
    for (const item of items) {
      const parent = parentPath(item.path);
      if (!state.contents.has(parent)) state.contents.set(parent, []);
      state.contents.get(parent).push(item);
      if (item.type === "tree" && !state.contents.has(item.path)) {
        state.contents.set(item.path, []);
      }
    }
  }

  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CONFIG.cacheKey));
      if (!cached || !Array.isArray(cached.items)) return false;
      hydrate(cached.items, {
        syncedAt: cached.syncedAt ? new Date(cached.syncedAt) : new Date(),
        source: "cached",
        sha: cached.sha || ""
      });
      return true;
    } catch (error) {
      localStorage.removeItem(CONFIG.cacheKey);
      return false;
    }
  }

  function saveCache(items, sha) {
    try {
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
        items,
        sha,
        syncedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Caching is optional. The live index remains functional without storage.
    }
  }

  function hydrate(items, options) {
    state.items = normalizeTree(items);
    state.loading = false;
    state.lastSync = options.syncedAt;
    state.source = options.source;
    state.treeSha = options.sha;
    buildIndex(state.items);
    readPathFromHash();
    updateStatistics();
    renderAll();
    updateSyncUi();
  }

  async function fetchTree({ background = false } = {}) {
    if (!background) {
      elements.refreshButton.classList.add("loading");
      elements.refreshButton.disabled = true;
    }
    setStatus("loading", background ? "Checking for updates" : "Syncing index");
    hideError();

    try {
      const response = await fetch(apiUrl, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) {
        const limited = response.headers.get("x-ratelimit-remaining") === "0";
        throw new Error(`GitHub returned ${response.status}.${limited ? " The API rate limit will reset automatically." : ""}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload.tree)) {
        throw new Error("GitHub returned an unexpected tree response.");
      }

      const items = normalizeTree(payload.tree);
      const changed = payload.sha !== state.treeSha || state.items.length !== items.length;
      hydrate(items, {
        syncedAt: new Date(),
        source: "network",
        sha: payload.sha || ""
      });
      saveCache(items, payload.sha || "");
      if (payload.truncated) {
        showError("GitHub truncated this unusually large tree. Some deeply nested files may not appear.");
      }
      if (background && changed) showToast("Repository index updated");
    } catch (error) {
      if (state.items.length) {
        state.source = "cached";
        setStatus("cached", "Cached snapshot");
        showError(`Live sync is temporarily unavailable. Showing the last saved index. ${error.message}`);
        updateSyncUi();
      } else {
        setStatus("error", "Index unavailable");
        showError(`${error.message} You can still browse the repository directly on GitHub.`);
        elements.fileRows.innerHTML = "";
        elements.emptyState.classList.add("visible");
        elements.resultSummary.textContent = "No data";
      }
    } finally {
      elements.refreshButton.classList.remove("loading");
      elements.refreshButton.disabled = false;
    }
  }

  function setStatus(status, text) {
    elements.statusPill.dataset.state = status;
    elements.statusText.textContent = text;
  }

  function updateSyncUi() {
    if (state.source === "network") {
      setStatus("ready", `Live from ${CONFIG.branch}`);
      elements.syncCaption.textContent = `Synced from ${CONFIG.owner}/${CONFIG.repository} · ${relativeTime(state.lastSync)}`;
    } else {
      setStatus("cached", "Cached snapshot");
      elements.syncCaption.textContent = `Cached GitHub snapshot · ${relativeTime(state.lastSync)}`;
    }
    elements.lastUpdated.textContent = `Last synced ${relativeTime(state.lastSync)} · auto-refreshes every 5 minutes`;
  }

  function updateStatistics() {
    const files = state.items.filter(item => item.type === "blob");
    const folders = state.items.filter(item => item.type === "tree");
    const maps = files.filter(item => fileKind(item) === "map");
    const bytes = files.reduce((sum, item) => sum + (item.size || 0), 0);
    elements.mapCount.textContent = maps.length.toLocaleString();
    elements.fileCount.textContent = files.length.toLocaleString();
    elements.folderCount.textContent = folders.length.toLocaleString();
    elements.repoSize.textContent = formatSize(bytes);
    elements.directoryCount.textContent = folders.length.toLocaleString();
  }

  function descendantFileCount(path) {
    const prefix = path ? `${path}/` : "";
    return state.items.filter(item => item.type === "blob" && item.path.startsWith(prefix)).length;
  }

  function orderedDirectories() {
    const result = [];
    const visit = (parent, depth) => {
      const children = (state.contents.get(parent) || [])
        .filter(item => item.type === "tree")
        .sort((a, b) => basename(a.path).localeCompare(basename(b.path), undefined, { sensitivity: "base" }));
      for (const child of children) {
        result.push({ item: child, depth });
        visit(child.path, depth + 1);
      }
    };
    visit("", 0);
    return result;
  }

  function renderDirectories() {
    elements.directoryTree.innerHTML = "";
    const root = { item: { path: "", type: "tree" }, depth: 0, root: true };
    for (const entry of [root, ...orderedDirectories()]) {
      const path = entry.item.path;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `directory-button${path === state.currentPath && state.view === "browse" && !state.query ? " active" : ""}`;
      button.style.paddingLeft = `${8 + (entry.root ? 0 : entry.depth * 13)}px`;
      button.setAttribute("aria-label", entry.root ? "Repository root" : `Open ${path}`);
      button.innerHTML = ICONS.folder;

      const name = document.createElement("span");
      name.className = "directory-name";
      name.textContent = entry.root ? "Repository root" : basename(path);
      button.append(name);

      const count = document.createElement("span");
      count.className = "directory-files";
      count.textContent = descendantFileCount(path);
      button.append(count);
      button.addEventListener("click", () => navigateTo(path));
      elements.directoryTree.append(button);
    }
  }

  function renderBreadcrumbs() {
    elements.breadcrumbs.innerHTML = "";
    if (state.query) {
      appendCrumb(`Search: ${state.query}`, "", true, false);
      return;
    }
    if (state.view === "all") {
      appendCrumb("All repository files", "", true, false);
      return;
    }

    const segments = state.currentPath ? state.currentPath.split("/") : [];
    const paths = [{ label: "root", path: "" }];
    segments.forEach((segment, index) => paths.push({
      label: segment,
      path: segments.slice(0, index + 1).join("/")
    }));
    paths.forEach((entry, index) => {
      if (index) {
        const separator = document.createElement("span");
        separator.className = "crumb-separator";
        separator.textContent = "/";
        elements.breadcrumbs.append(separator);
      }
      appendCrumb(entry.label, entry.path, index === paths.length - 1, true);
    });
  }

  function appendCrumb(label, path, current, interactive) {
    const crumb = document.createElement(interactive ? "button" : "span");
    if (interactive) crumb.type = "button";
    crumb.className = `crumb${current ? " current" : ""}`;
    crumb.textContent = label;
    if (interactive) crumb.addEventListener("click", () => navigateTo(path));
    elements.breadcrumbs.append(crumb);
  }

  function queryTokens() {
    return state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function searchScore(item, tokens) {
    const path = item.path.toLocaleLowerCase();
    const name = basename(item.path).toLocaleLowerCase();
    if (!tokens.every(token => path.includes(token))) return -1;
    return tokens.reduce((score, token) => {
      if (name === token) return score + 100;
      if (name.startsWith(token)) return score + 55;
      if (name.includes(token)) return score + 30;
      return score + 8;
    }, 0);
  }

  function matchesFilter(item) {
    if (state.filter === "all") return true;
    const kind = fileKind(item);
    if (state.filter === "maps") return kind === "map";
    if (state.filter === "assets") {
      return ["archive", "image", "file"].includes(kind) && item.type !== "tree";
    }
    return state.filter === "code" ? ["code", "cockpit"].includes(kind) : true;
  }

  function visibleItems() {
    const tokens = queryTokens();
    let items;
    if (tokens.length) {
      items = state.items
        .map(item => ({ item, score: searchScore(item, tokens) }))
        .filter(entry => entry.score >= 0)
        .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
        .map(entry => entry.item);
    } else if (state.view === "all") {
      items = state.items.filter(item => item.type === "blob");
    } else {
      items = [...(state.contents.get(state.currentPath) || [])];
    }
    items = items.filter(matchesFilter);
    if (!tokens.length) items.sort(compareItems);
    return items;
  }

  function compareItems(a, b) {
    if (state.view === "browse" && !state.query && a.type !== b.type) {
      return a.type === "tree" ? -1 : 1;
    }
    let comparison;
    if (state.sort === "size") comparison = (a.size || 0) - (b.size || 0);
    else if (state.sort === "type") comparison = typeLabel(a).localeCompare(typeLabel(b));
    else comparison = basename(a.path).localeCompare(basename(b.path), undefined, { numeric: true, sensitivity: "base" });
    if (!comparison) comparison = a.path.localeCompare(b.path);
    return comparison * state.sortDirection;
  }

  function highlightedText(text) {
    const fragment = document.createDocumentFragment();
    const token = state.query.trim().split(/\s+/).find(part => part && text.toLowerCase().includes(part.toLowerCase()));
    if (!token) {
      fragment.append(document.createTextNode(text));
      return fragment;
    }
    const index = text.toLowerCase().indexOf(token.toLowerCase());
    fragment.append(document.createTextNode(text.slice(0, index)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + token.length);
    fragment.append(mark, document.createTextNode(text.slice(index + token.length)));
    return fragment;
  }

  function renderRows() {
    const items = visibleItems();
    elements.fileRows.innerHTML = "";
    elements.emptyState.classList.toggle("visible", items.length === 0 && !state.loading);
    elements.resultSummary.textContent = `${items.length.toLocaleString()} ${items.length === 1 ? "item" : "items"}`;
    for (const item of items) elements.fileRows.append(buildRow(item));
  }

  function buildRow(item) {
    const kind = fileKind(item);
    const row = document.createElement("tr");
    row.className = "file-row";

    const nameCell = document.createElement("td");
    const primary = document.createElement("div");
    primary.className = "file-primary";
    const icon = document.createElement("span");
    icon.className = `file-icon ${kind}`;
    icon.innerHTML = ICONS[kind] || ICONS.file;
    primary.append(icon);

    const previewsMap = kind === "map";
    const control = document.createElement(item.type === "tree" || previewsMap ? "button" : "a");
    control.className = item.type === "tree" || previewsMap ? "file-name-button" : "file-name-link";
    control.title = item.path;
    control.append(highlightedText(basename(item.path)));
    if (item.type === "tree") {
      control.type = "button";
      control.addEventListener("click", () => navigateTo(item.path));
    } else if (previewsMap) {
      control.type = "button";
      control.title = `Preview ${item.path}`;
      control.addEventListener("click", () => openMapPreview(item));
    } else {
      control.href = `${repositoryUrl}/blob/${encodeURIComponent(CONFIG.branch)}/${encodePath(item.path)}`;
      control.target = "_blank";
      control.rel = "noreferrer";
    }
    primary.append(control);
    nameCell.append(primary);

    const typeCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = typeLabel(item);
    typeCell.append(badge);

    const sizeCell = document.createElement("td");
    sizeCell.className = "size-cell";
    sizeCell.textContent = item.type === "tree" ? `${descendantFileCount(item.path)} files` : formatSize(item.size);

    const pathCell = document.createElement("td");
    pathCell.className = "path-cell";
    pathCell.title = item.path;
    pathCell.textContent = parentPath(item.path) || "/";

    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    if (previewsMap) {
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "icon-button preview-action";
      preview.title = "Preview map";
      preview.setAttribute("aria-label", `Preview map ${item.path}`);
      preview.innerHTML = ICONS.preview;
      preview.addEventListener("click", () => openMapPreview(item));
      actions.append(preview);
    }
    if (item.type === "blob") {
      const open = document.createElement("a");
      open.className = "icon-button";
      open.href = `${repositoryUrl}/blob/${encodeURIComponent(CONFIG.branch)}/${encodePath(item.path)}`;
      open.target = "_blank";
      open.rel = "noreferrer";
      open.title = "Open on GitHub";
      open.setAttribute("aria-label", `Open ${item.path} on GitHub`);
      open.innerHTML = ICONS.external;
      actions.append(open);
    } else {
      const download = document.createElement("button");
      download.type = "button";
      download.className = "icon-button download-action";
      download.title = "Download directory";
      download.setAttribute("aria-label", `Download directory ${item.path}`);
      download.innerHTML = ICONS.download;
      download.addEventListener("click", () => downloadDirectory(item.path));
      actions.append(download);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "icon-button";
    copy.title = "Copy path";
    copy.setAttribute("aria-label", `Copy path ${item.path}`);
    copy.innerHTML = ICONS.copy;
    copy.addEventListener("click", () => copyPath(item.path));
    actions.append(copy);
    actionCell.append(actions);

    row.append(nameCell, typeCell, sizeCell, pathCell, actionCell);
    return row;
  }

  function renderAll() {
    renderDirectories();
    renderBreadcrumbs();
    renderRows();
    updateDirectoryDownloadUi();
    document.querySelectorAll(".view-button").forEach(button => {
      button.classList.toggle("active", button.dataset.view === state.view && !state.query);
    });
    document.querySelectorAll(".filter-chip").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
  }

  function downloadScopePath() {
    return state.query || state.view === "all" ? "" : state.currentPath;
  }

  function updateDirectoryDownloadUi() {
    const path = downloadScopePath();
    const name = path ? basename(path) : "root";
    elements.directoryDownloadLabel.textContent = path ? `Download ${name}` : "Download all";
    elements.directoryDownloadButton.setAttribute("aria-label", path ? `Download directory ${path}` : "Download entire repository");
  }

  function navigateTo(path) {
    if (path && !state.contents.has(path)) return;
    state.currentPath = path;
    state.view = "browse";
    clearSearch(false);
    const hash = path ? `#path=${encodeURIComponent(path)}` : "#";
    if (window.location.hash !== hash) history.pushState(null, "", hash);
    renderAll();
    $(".browser-shell").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readPathFromHash() {
    const match = window.location.hash.match(/^#path=(.*)$/);
    if (!match) {
      state.currentPath = "";
      return;
    }
    try {
      const path = decodeURIComponent(match[1]);
      if (state.contents.has(path)) state.currentPath = path;
    } catch (error) {
      state.currentPath = "";
    }
  }

  function clearSearch(focus = true) {
    state.query = "";
    elements.searchInput.value = "";
    elements.clearSearch.classList.remove("visible");
    if (focus) elements.searchInput.focus();
  }

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  let previewRequest = 0;

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NAMESPACE, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }

  function numericAttribute(element, name) {
    const value = element?.getAttribute(name);
    if (value === null || !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function pointFromElement(element) {
    const x = numericAttribute(element, "x");
    const y = numericAttribute(element, "y");
    return x === null || y === null ? null : { x, y };
  }

  function directChildren(element, name) {
    return [...element.children].filter(child => child.localName === name);
  }

  async function fetchMapText(path) {
    const response = await fetch(rawFileUrl(path), { cache: "no-store" });
    if (!response.ok) throw new Error(`Map file returned ${response.status}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const declaration = new TextDecoder("ascii").decode(bytes.slice(0, 180));
    const declaredEncoding = declaration.match(/encoding\s*=\s*["']([^"']+)/i)?.[1] || "utf-8";
    try {
      return new TextDecoder(declaredEncoding).decode(bytes);
    } catch (error) {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }

  function zoneEffect(zone) {
    const direct = zone.getAttribute("effect");
    if (direct) return direct.toLowerCase();
    const nested = [...zone.getElementsByTagName("Effect")]
      .map(effect => effect.getAttribute("effect"))
      .find(Boolean);
    return nested ? nested.toLowerCase() : "other";
  }

  function parseMapDocument(source) {
    const mapDocument = new DOMParser().parseFromString(source, "application/xml");
    if (mapDocument.querySelector("parsererror")) throw new Error("The map XML could not be parsed.");
    const resource = mapDocument.documentElement;
    if (resource?.getAttribute("type")?.toLowerCase() !== "aamap") {
      throw new Error("This resource is not an Armagetron map.");
    }

    const walls = [...mapDocument.getElementsByTagName("Wall")]
      .map(wall => directChildren(wall, "Point").map(pointFromElement).filter(Boolean))
      .filter(points => points.length > 1);
    const zones = [...mapDocument.getElementsByTagName("Zone")].flatMap(zone => {
      const effect = zoneEffect(zone);
      const circle = zone.getElementsByTagName("ShapeCircle")[0];
      if (circle) {
        const center = directChildren(circle, "Point").map(pointFromElement).find(Boolean);
        const radius = numericAttribute(circle, "radius");
        return center && radius !== null && radius >= 0 ? [{ type: "circle", effect, center, radius }] : [];
      }
      const polygon = zone.getElementsByTagName("ShapePolygon")[0];
      if (!polygon) return [];
      let pointElements = directChildren(polygon, "Point");
      const colorIndex = [...polygon.children].findIndex(child => child.localName === "Color");
      if (colorIndex > 0 && pointElements.length > 3) pointElements = pointElements.slice(1);
      const points = pointElements.map(pointFromElement).filter(Boolean);
      return points.length > 2 ? [{ type: "polygon", effect, points }] : [];
    });
    const spawns = [...mapDocument.getElementsByTagName("Spawn")].flatMap(spawn => {
      const x = numericAttribute(spawn, "x");
      const y = numericAttribute(spawn, "y");
      if (x === null || y === null) return [];
      let dx = numericAttribute(spawn, "xdir");
      let dy = numericAttribute(spawn, "ydir");
      if (dx === null || dy === null) {
        const angle = numericAttribute(spawn, "angle") || 0;
        const radians = angle * Math.PI / 180;
        dx = Math.cos(radians);
        dy = Math.sin(radians);
      }
      const magnitude = Math.hypot(dx, dy) || 1;
      return [{ x, y, dx: dx / magnitude, dy: dy / magnitude }];
    });

    return {
      name: resource.getAttribute("name") || "Untitled map",
      author: resource.getAttribute("author") || "Unknown author",
      version: resource.getAttribute("version") || "Unknown version",
      walls,
      zones,
      spawns
    };
  }

  function renderMapGeometry(map) {
    elements.previewSvg.replaceChildren();
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const include = (x, y) => {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    };
    map.walls.flat().forEach(point => include(point.x, point.y));
    map.zones.forEach(zone => {
      if (zone.type === "circle") {
        include(zone.center.x - zone.radius, zone.center.y - zone.radius);
        include(zone.center.x + zone.radius, zone.center.y + zone.radius);
      } else zone.points.forEach(point => include(point.x, point.y));
    });
    map.spawns.forEach(spawn => include(spawn.x, spawn.y));
    if (!Number.isFinite(bounds.minX)) throw new Error("No drawable wall, zone, or spawn geometry was found.");

    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = Math.max(width, height) * .045;
    elements.previewSvg.setAttribute("viewBox", `${bounds.minX - padding} ${-(bounds.maxY + padding)} ${width + padding * 2} ${height + padding * 2}`);
    elements.previewSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const group = svgElement("g", { transform: "scale(1 -1)" });

    for (const points of map.walls) {
      group.append(svgElement("polyline", {
        class: "map-wall",
        points: points.map(point => `${point.x},${point.y}`).join(" ")
      }));
    }
    for (const zone of map.zones) {
      const effectClass = zone.effect === "win" ? "win" : zone.effect === "death" ? "death" : "other";
      if (zone.type === "circle") {
        group.append(svgElement("circle", {
          class: `zone ${effectClass}`,
          cx: zone.center.x,
          cy: zone.center.y,
          r: zone.radius
        }));
      } else {
        group.append(svgElement("polygon", {
          class: `zone ${effectClass}`,
          points: zone.points.map(point => `${point.x},${point.y}`).join(" ")
        }));
      }
    }

    const arrowLength = Math.max(width, height) * .032;
    const headLength = arrowLength * .42;
    for (const spawn of map.spawns) {
      const endX = spawn.x + spawn.dx * arrowLength;
      const endY = spawn.y + spawn.dy * arrowLength;
      const normalX = -spawn.dy * headLength * .5;
      const normalY = spawn.dx * headLength * .5;
      group.append(svgElement("line", { class: "spawn-line", x1: spawn.x, y1: spawn.y, x2: endX, y2: endY }));
      group.append(svgElement("polygon", {
        class: "spawn-head",
        points: `${endX},${endY} ${endX - spawn.dx * headLength + normalX},${endY - spawn.dy * headLength + normalY} ${endX - spawn.dx * headLength - normalX},${endY - spawn.dy * headLength - normalY}`
      }));
    }
    elements.previewSvg.append(group);
  }

  async function openMapPreview(item) {
    const request = ++previewRequest;
    elements.previewTitle.textContent = basename(item.path).replace(/-v1\.aamap\.xml$/i, "");
    elements.previewMeta.textContent = item.path;
    elements.previewRawLink.href = `${repositoryUrl}/blob/${encodeURIComponent(CONFIG.branch)}/${encodePath(item.path)}`;
    elements.previewSvg.replaceChildren();
    elements.previewLoading.className = "preview-loading";
    elements.previewLoading.innerHTML = "<span></span>Reading map geometry…";
    if (!elements.previewDialog.open) elements.previewDialog.showModal();

    try {
      let map = state.previewCache.get(item.path);
      if (!map) {
        map = parseMapDocument(await fetchMapText(item.path));
        state.previewCache.set(item.path, map);
      }
      if (request !== previewRequest) return;
      renderMapGeometry(map);
      elements.previewTitle.textContent = map.name;
      elements.previewMeta.textContent = `${map.author} · ${map.version} · ${map.walls.length.toLocaleString()} walls · ${map.zones.length.toLocaleString()} zones · ${map.spawns.length.toLocaleString()} spawns`;
      elements.previewLoading.classList.add("hidden");
    } catch (error) {
      if (request !== previewRequest) return;
      elements.previewLoading.classList.add("error");
      elements.previewLoading.textContent = error.message;
    }
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipTimestamp(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function createZip(entries) {
    const encoder = new TextEncoder();
    const chunks = [];
    const centralRecords = [];
    const timestamp = zipTimestamp();
    let offset = 0;

    for (const entry of entries) {
      const name = encoder.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, timestamp.time, true);
      localView.setUint16(12, timestamp.date, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, data);

      const central = new Uint8Array(46 + name.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, timestamp.time, true);
      centralView.setUint16(14, timestamp.date, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, offset, true);
      central.set(name, 46);
      centralRecords.push(central);
      offset += local.length + data.length;
    }

    const centralSize = centralRecords.reduce((sum, record) => sum + record.length, 0);
    chunks.push(...centralRecords);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    chunks.push(end);
    return new Blob(chunks, { type: "application/zip" });
  }

  async function fetchDirectoryEntries(files, path) {
    const entries = new Array(files.length);
    const stripPrefix = parentPath(path);
    let cursor = 0;
    let completed = 0;
    async function worker() {
      while (cursor < files.length) {
        const index = cursor;
        cursor += 1;
        const file = files[index];
        const response = await fetch(rawFileUrl(file.path), { cache: "no-store" });
        if (!response.ok) throw new Error(`${file.path} returned ${response.status}`);
        const data = new Uint8Array(await response.arrayBuffer());
        const name = stripPrefix ? file.path.slice(stripPrefix.length + 1) : file.path;
        entries[index] = { name, data };
        completed += 1;
        showProgress(`Preparing ${basename(path)} · ${completed.toLocaleString()} / ${files.length.toLocaleString()} files`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker));
    return entries;
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setDownloadControls(disabled) {
    elements.directoryDownloadButton.disabled = disabled;
    document.querySelectorAll(".download-action").forEach(button => { button.disabled = disabled; });
  }

  async function downloadDirectory(path) {
    if (!path) {
      window.location.assign(archiveUrl);
      return;
    }
    if (state.downloading) {
      showProgress("A directory download is already being prepared.");
      return;
    }
    const prefix = `${path}/`;
    const files = state.items.filter(item => item.type === "blob" && item.path.startsWith(prefix));
    if (!files.length) {
      showToast("This directory has no files to download.");
      return;
    }

    state.downloading = true;
    setDownloadControls(true);
    showProgress(`Preparing ${basename(path)} · 0 / ${files.length.toLocaleString()} files`);
    try {
      const entries = await fetchDirectoryEntries(files, path);
      const zip = createZip(entries);
      const safeName = basename(path).replace(/[^A-Za-z0-9._-]+/g, "-") || "directory";
      saveBlob(zip, `${safeName}-${CONFIG.branch}.zip`);
      showToast(`${basename(path)} downloaded · ${formatSize(zip.size)}`);
    } catch (error) {
      showToast(`Download failed: ${error.message}`, 5000);
    } finally {
      state.downloading = false;
      setDownloadControls(false);
    }
  }

  async function copyPath(path) {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      const input = document.createElement("textarea");
      input.value = path;
      input.style.cssText = "position:fixed;opacity:0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast("Path copied");
  }

  let toastTimer;
  function showToast(message, duration = 1800) {
    elements.toast.textContent = message;
    elements.toast.classList.remove("progress");
    elements.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), duration);
  }

  function showProgress(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("visible", "progress");
  }

  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorBanner.classList.add("visible");
  }

  function hideError() {
    elements.errorBanner.classList.remove("visible");
  }

  elements.searchInput.addEventListener("input", event => {
    state.query = event.target.value;
    elements.clearSearch.classList.toggle("visible", Boolean(state.query));
    renderAll();
  });

  elements.clearSearch.addEventListener("click", () => {
    clearSearch();
    renderAll();
  });

  document.querySelectorAll(".view-button").forEach(button => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      clearSearch(false);
      renderAll();
    });
  });

  document.querySelectorAll(".filter-chip").forEach(button => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderAll();
    });
  });

  document.querySelectorAll(".sort-button").forEach(button => {
    button.addEventListener("click", () => {
      if (state.sort === button.dataset.sort) state.sortDirection *= -1;
      else {
        state.sort = button.dataset.sort;
        state.sortDirection = 1;
      }
      document.querySelectorAll(".sort-button").forEach(sortButton => {
        sortButton.classList.toggle("active", sortButton.dataset.sort === state.sort);
        if (sortButton.dataset.sort === "name") {
          sortButton.textContent = state.sort === "name" ? `Name ${state.sortDirection > 0 ? "↑" : "↓"}` : "Name";
        }
      });
      renderRows();
    });
  });

  elements.refreshButton.addEventListener("click", () => fetchTree());
  elements.directoryDownloadButton.addEventListener("click", () => downloadDirectory(downloadScopePath()));
  elements.previewClose.addEventListener("click", () => elements.previewDialog.close());
  elements.previewDialog.addEventListener("click", event => {
    if (event.target === elements.previewDialog) elements.previewDialog.close();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      elements.searchInput.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.searchInput) {
      clearSearch(false);
      elements.searchInput.blur();
      renderAll();
    }
  });

  window.addEventListener("hashchange", () => {
    readPathFromHash();
    state.view = "browse";
    clearSearch(false);
    renderAll();
  });

  window.setInterval(() => {
    updateSyncUi();
    fetchTree({ background: true });
  }, CONFIG.refreshInterval);

  document.addEventListener("visibilitychange", () => {
    const stale = state.lastSync && Date.now() - state.lastSync.getTime() > CONFIG.refreshInterval;
    if (document.visibilityState === "visible" && stale) fetchTree({ background: true });
  });

  const hadCache = loadCache();
  fetchTree({ background: hadCache });
})();
