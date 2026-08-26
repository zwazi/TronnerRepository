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
    file: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 3v5h4M9 12h6M9 16h5" stroke="currentColor" stroke-width="1.6"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.6"/></svg>'
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
    treeSha: ""
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
    githubLink: $("#github-link")
  };

  const repositoryUrl = `https://github.com/${CONFIG.owner}/${CONFIG.repository}`;
  const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repository}/git/trees/${encodeURIComponent(CONFIG.branch)}?recursive=1`;
  elements.githubLink.href = repositoryUrl;

  const basename = path => path.split("/").pop() || path;
  const parentPath = path => path.split("/").slice(0, -1).join("/");
  const encodePath = path => path.split("/").map(encodeURIComponent).join("/");

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
    if (path.endsWith(".aamap.xml") && !path.includes("/cockpits/")) return "map";
    if (/\.(zip|7z|tar|gz)$/.test(path)) return "archive";
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(path)) return "image";
    if (/\.(html?|css|js|mjs|py|php|cfg|dtd|json|ya?ml|toml|sh)$/.test(path)) return "code";
    return "file";
  }

  function typeLabel(item) {
    const kind = fileKind(item);
    if (kind === "folder") return "Folder";
    if (kind === "map") return "AAMap";
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
    return state.filter === "code" ? kind === "code" : true;
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

    const control = document.createElement(item.type === "tree" ? "button" : "a");
    control.className = item.type === "tree" ? "file-name-button" : "file-name-link";
    control.title = item.path;
    control.append(highlightedText(basename(item.path)));
    if (item.type === "tree") {
      control.type = "button";
      control.addEventListener("click", () => navigateTo(item.path));
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
    document.querySelectorAll(".view-button").forEach(button => {
      button.classList.toggle("active", button.dataset.view === state.view && !state.query);
    });
    document.querySelectorAll(".filter-chip").forEach(button => {
      button.classList.toggle("active", button.dataset.filter === state.filter);
    });
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
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 1800);
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
