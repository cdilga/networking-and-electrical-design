const state = {
  payload: null,
  documents: [],
  activePath: null,
  filter: "all",
  query: "",
  renderToken: 0,
};

const markdownModuleUrl =
  "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
let markedModulePromise = null;

const siteTitle = document.querySelector("#siteTitle");
const siteSubtitle = document.querySelector("#siteSubtitle");
const siteTagline = document.querySelector("#siteTagline");
const statGrid = document.querySelector("#statGrid");
const recentGrid = document.querySelector("#recentGrid");
const filterRow = document.querySelector("#filterRow");
const folderSummary = document.querySelector("#folderSummary");
const browserGroups = document.querySelector("#browserGroups");
const resultSummary = document.querySelector("#resultSummary");
const searchInput = document.querySelector("#searchInput");
const browserToggle = document.querySelector("#browserToggle");
const closeBrowser = document.querySelector("#closeBrowser");
const immersiveToggle = document.querySelector("#immersiveToggle");
const drawerScrim = document.querySelector("#drawerScrim");
const downloadLink = document.querySelector("#downloadLink");
const rawLink = document.querySelector("#rawLink");
const copyLinkButton = document.querySelector("#copyLinkButton");
const viewerPath = document.querySelector("#viewerPath");
const viewerTitle = document.querySelector("#viewerTitle");
const viewerMeta = document.querySelector("#viewerMeta");
const viewerBadges = document.querySelector("#viewerBadges");
const viewerStage = document.querySelector("#viewerStage");

const categoryLabels = {
  all: "All",
  page: "Pages",
  drawing: "Drawings",
  pdf: "PDF",
  image: "Images",
  text: "Text",
  data: "Data",
  media: "Media",
  office: "Office",
  download: "Other",
};

const defaultCategoryOrder = {
  page: 0,
  pdf: 1,
  drawing: 2,
  image: 3,
  office: 4,
  media: 5,
  text: 6,
  data: 7,
  download: 8,
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadLibrary();
});

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderBrowser();
  });

  browserToggle.addEventListener("click", () => setBrowserOpen(true));
  closeBrowser.addEventListener("click", () => setBrowserOpen(false));
  drawerScrim.addEventListener("click", () => setBrowserOpen(false));

  immersiveToggle.addEventListener("click", () => {
    const isImmersive = document.body.classList.toggle("immersive-mode");
    immersiveToggle.setAttribute("aria-pressed", String(isImmersive));
    immersiveToggle.textContent = isImmersive ? "Exit full screen" : "Full screen";
  });

  copyLinkButton.addEventListener("click", async () => {
    if (!state.activePath) {
      return;
    }

    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("doc", state.activePath);

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      const originalLabel = copyLinkButton.textContent;
      copyLinkButton.textContent = "Link copied";
      window.setTimeout(() => {
        copyLinkButton.textContent = originalLabel;
      }, 1200);
    } catch (error) {
      console.error(error);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setBrowserOpen(false);
      if (document.body.classList.contains("immersive-mode")) {
        document.body.classList.remove("immersive-mode");
        immersiveToggle.setAttribute("aria-pressed", "false");
        immersiveToggle.textContent = "Full screen";
      }
    }
  });
}

async function loadLibrary() {
  try {
    const response = await fetch("./data/documents.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load document manifest: ${response.status}`);
    }

    state.payload = await response.json();
    state.documents = state.payload.documents;
    populateStaticContent();
    renderStats();
    renderFilters();
    renderRecent();
    renderBrowser();

    const requestedPath = new URLSearchParams(window.location.search).get("doc");
    const requestedDocument = state.documents.find(
      (entry) => entry.path === requestedPath
    );
    const initialDocument =
      requestedDocument || pickDefaultDocument(state.documents);

    if (initialDocument) {
      await selectDocument(initialDocument.path, { replace: true });
    } else {
      renderEmptyLibrary();
    }
  } catch (error) {
    console.error(error);
    viewerStage.innerHTML = `
      <div class="fallback-state">
        <p class="eyebrow">Manifest error</p>
        <h3>Unable to load the document library</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function populateStaticContent() {
  const { site } = state.payload;
  document.title = `${site.title} | Document Library`;
  siteTitle.textContent = site.title;
  siteSubtitle.textContent = site.subtitle;
  siteTagline.textContent = site.tagline;
}

function renderStats() {
  const { stats } = state.payload;
  const cards = [
    { label: "Files", value: stats.file_count },
    { label: "Folders", value: stats.folder_count },
    { label: "Library size", value: stats.total_size_label },
    {
      label: "Latest update",
      value: stats.latest_update ? formatShortDate(stats.latest_update) : "None yet",
    },
  ];

  statGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <p class="stat-label">${card.label}</p>
          <p class="stat-value">${card.value}</p>
        </article>
      `
    )
    .join("");
}

function renderFilters() {
  const categories = new Set(state.documents.map((entry) => entry.category));
  const orderedCategories = ["all", ...Object.keys(categoryLabels).filter((key) => key !== "all" && categories.has(key))];

  filterRow.innerHTML = orderedCategories
    .map((category) => {
      const count =
        category === "all"
          ? state.documents.length
          : state.documents.filter((entry) => entry.category === category).length;

      return `
        <button
          class="filter-chip ${state.filter === category ? "active" : ""}"
          type="button"
          data-filter="${category}"
          aria-pressed="${state.filter === category}"
        >
          ${categoryLabels[category]} (${count})
        </button>
      `;
    })
    .join("");

  filterRow.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderBrowser();
    });
  });
}

function renderRecent() {
  const recentDocuments = [...state.documents]
    .sort((left, right) => Date.parse(right.modified_at) - Date.parse(left.modified_at))
    .slice(0, 4);

  recentGrid.innerHTML = recentDocuments
    .map(
      (entry) => `
        <button class="recent-card" type="button" data-doc-path="${entry.path}">
          <span class="file-tag">${entry.extension_label}</span>
          <h4>${escapeHtml(entry.title)}</h4>
          <p>${escapeHtml(entry.folder || "documents")}</p>
          <p class="browser-file-meta">Updated ${formatLongDate(entry.modified_at)}</p>
        </button>
      `
    )
    .join("");

  recentGrid.querySelectorAll("[data-doc-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      await selectDocument(button.dataset.docPath);
    });
  });
}

function renderBrowser() {
  const visibleDocuments = getVisibleDocuments();
  const folders = groupDocumentsByFolder(visibleDocuments);
  const resultsLabel =
    visibleDocuments.length === state.documents.length
      ? `${visibleDocuments.length} files available`
      : `${visibleDocuments.length} matching files`;

  resultSummary.textContent = resultsLabel;
  folderSummary.textContent = `${folders.length} folders shown`;

  if (!visibleDocuments.length) {
    browserGroups.innerHTML = `
      <div class="fallback-state">
        <p class="eyebrow">No matches</p>
        <h3>Nothing matched the current filter</h3>
        <p>Try a broader search or switch the file-type filter.</p>
      </div>
    `;
    return;
  }

  browserGroups.innerHTML = folders
    .map(({ folder, entries }) => {
      const files = entries
        .map(
          (entry) => `
            <button
              class="browser-file ${entry.path === state.activePath ? "active" : ""}"
              type="button"
              data-doc-path="${entry.path}"
            >
              <div class="browser-file-topline">
                <span class="file-tag">${entry.extension_label}</span>
                <span class="browser-file-meta">${entry.size_label}</span>
              </div>
              <p class="browser-file-name">${escapeHtml(entry.title)}</p>
              <p class="browser-file-meta">
                ${escapeHtml(entry.name)} · ${formatLongDate(entry.modified_at)}
              </p>
            </button>
          `
        )
        .join("");

      return `
        <section class="browser-group">
          <div class="browser-group-header">
            <p class="browser-group-title">${escapeHtml(folder || "documents")}</p>
            <p class="browser-group-count">${entries.length} file${entries.length === 1 ? "" : "s"}</p>
          </div>
          <div class="browser-files">
            ${files}
          </div>
        </section>
      `;
    })
    .join("");

  browserGroups.querySelectorAll("[data-doc-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      await selectDocument(button.dataset.docPath);
    });
  });
}

async function selectDocument(path, options = {}) {
  const entry = state.documents.find((item) => item.path === path);
  if (!entry) {
    return;
  }

  state.activePath = path;
  renderBrowser();
  updateViewerHeader(entry);
  updateActionLinks(entry);
  updateLocation(path, options.replace);
  await renderPreview(entry);

  if (window.innerWidth <= 960) {
    setBrowserOpen(false);
  }
}

function updateViewerHeader(entry) {
  viewerPath.textContent = entry.relative_path;
  viewerTitle.textContent = entry.title;
  viewerMeta.textContent = `${entry.size_label} · ${formatLongDate(entry.modified_at)} · ${entry.mime_type}`;
  viewerBadges.innerHTML = [
    entry.category,
    entry.extension_label,
    entry.folder || "documents",
  ]
    .map((badge) => `<span class="viewer-badge">${escapeHtml(badge)}</span>`)
    .join("");
}

function updateActionLinks(entry) {
  const href = entry.path;
  downloadLink.href = href;
  downloadLink.classList.remove("disabled");
  downloadLink.removeAttribute("aria-disabled");
  downloadLink.setAttribute("download", entry.name);

  rawLink.href = href;
  rawLink.classList.remove("disabled");
  rawLink.removeAttribute("aria-disabled");
  rawLink.target = "_blank";
  rawLink.rel = "noreferrer";

  copyLinkButton.disabled = false;
}

function updateLocation(path, replace = false) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("doc", path);
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", nextUrl);
}

async function renderPreview(entry) {
  const token = ++state.renderToken;
  viewerStage.innerHTML = `
    <div class="loading-state">
      <p class="eyebrow">Loading</p>
      <h3>Preparing preview</h3>
      <p>${escapeHtml(entry.name)}</p>
    </div>
  `;

  try {
    let previewNode = null;

    switch (entry.preview_type) {
      case "html":
      case "pdf": {
        const frame = document.createElement("iframe");
        frame.className = "viewer-frame";
        frame.src = entry.path;
        frame.title = entry.title;
        previewNode = frame;
        break;
      }
      case "svg":
      case "image": {
        const image = document.createElement("img");
        image.className = "viewer-image";
        image.src = entry.path;
        image.alt = entry.title;
        previewNode = image;
        break;
      }
      case "video": {
        const video = document.createElement("video");
        video.className = "viewer-media";
        video.src = entry.path;
        video.controls = true;
        video.playsInline = true;
        previewNode = video;
        break;
      }
      case "audio": {
        const wrapper = document.createElement("div");
        wrapper.className = "fallback-state";
        wrapper.innerHTML = `
          <p class="eyebrow">Audio preview</p>
          <h3>${escapeHtml(entry.title)}</h3>
          <audio controls preload="metadata" src="${escapeHtml(entry.path)}"></audio>
        `;
        previewNode = wrapper;
        break;
      }
      case "markdown": {
        const text = await fetchText(entry.path);
        const { marked } = await loadMarkedModule();
        const article = document.createElement("article");
        article.className = "markdown-body";
        article.innerHTML = marked.parse(text);
        previewNode = article;
        break;
      }
      case "table": {
        const text = await fetchText(entry.path);
        previewNode = renderTablePreview(text, entry.extension === ".tsv" ? "\t" : ",");
        break;
      }
      case "text": {
        const text = await fetchText(entry.path);
        previewNode = renderCodePreview(entry, text);
        break;
      }
      case "office": {
        const frame = document.createElement("iframe");
        frame.className = "viewer-frame";
        frame.title = entry.title;
        frame.src = buildOfficePreviewUrl(entry.path);
        previewNode = frame;
        break;
      }
      default: {
        previewNode = renderFallbackPreview(entry);
      }
    }

    if (token !== state.renderToken) {
      return;
    }

    viewerStage.innerHTML = "";
    viewerStage.append(previewNode);
  } catch (error) {
    console.error(error);
    if (token !== state.renderToken) {
      return;
    }
    viewerStage.innerHTML = `
      <div class="fallback-state">
        <p class="eyebrow">Preview unavailable</p>
        <h3>Open the raw file instead</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function renderEmptyLibrary() {
  viewerPath.textContent = "documents/";
  viewerTitle.textContent = "No files found";
  viewerMeta.textContent = "Add files into the documents folder and rebuild.";
  viewerBadges.innerHTML = "";
  viewerStage.innerHTML = `
    <div class="empty-state">
      <p class="eyebrow">Empty library</p>
      <h3>No documents are available yet</h3>
      <p>Drop files into the documents folder, then rebuild the site.</p>
    </div>
  `;
}

function renderCodePreview(entry, text) {
  const block = document.createElement("pre");
  block.className = "code-block";

  if (entry.extension === ".json") {
    try {
      block.textContent = JSON.stringify(JSON.parse(text), null, 2);
      return block;
    } catch (_error) {
      block.textContent = text;
      return block;
    }
  }

  block.textContent = text;
  return block;
}

function renderTablePreview(text, delimiter) {
  const rows = parseDelimited(text, delimiter);
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "fallback-state";
    empty.innerHTML = `
      <p class="eyebrow">Empty table</p>
      <h3>No data rows were found</h3>
    `;
    return empty;
  }

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "table-preview";

  const header = rows[0];
  const bodyRows = rows.slice(1);
  const theadCells = header.map((value) => `<th>${escapeHtml(value)}</th>`).join("");
  const tbodyRows = bodyRows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`
    )
    .join("");

  tableWrapper.innerHTML = `
    <table>
      <thead>
        <tr>${theadCells}</tr>
      </thead>
      <tbody>${tbodyRows}</tbody>
    </table>
  `;
  return tableWrapper;
}

function renderFallbackPreview(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = "fallback-state";
  wrapper.innerHTML = `
    <p class="eyebrow">Download only</p>
    <h3>${escapeHtml(entry.title)}</h3>
    <p>This file type is best opened raw or downloaded locally.</p>
    <div class="topbar-actions">
      <a class="button ghost" href="${escapeHtml(entry.path)}" target="_blank" rel="noreferrer">Open raw</a>
      <a class="button primary" href="${escapeHtml(entry.path)}" download="${escapeHtml(entry.name)}">Download</a>
    </div>
  `;
  return wrapper;
}

function getVisibleDocuments() {
  return state.documents.filter((entry) => {
    const matchesFilter = state.filter === "all" || entry.category === state.filter;
    const haystack = [
      entry.title,
      entry.name,
      entry.folder,
      entry.extension_label,
      entry.category,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesFilter && matchesQuery;
  });
}

function pickDefaultDocument(documents) {
  if (!documents.length) {
    return null;
  }

  return [...documents].sort((left, right) => {
    const leftScore = defaultCategoryOrder[left.category] ?? 99;
    const rightScore = defaultCategoryOrder[right.category] ?? 99;

    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    return left.name.localeCompare(right.name);
  })[0];
}

function groupDocumentsByFolder(entries) {
  const groups = new Map();

  entries.forEach((entry) => {
    const folder = entry.folder || "documents";
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder).push(entry);
  });

  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([folder, groupEntries]) => ({
      folder,
      entries: [...groupEntries].sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

function setBrowserOpen(isOpen) {
  document.body.classList.toggle("browser-open", isOpen);
  browserToggle.setAttribute("aria-expanded", String(isOpen));
  drawerScrim.hidden = !isOpen;
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }
  return response.text();
}

function buildOfficePreviewUrl(path) {
  const absoluteUrl = new URL(path, window.location.href).toString();
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
}

async function loadMarkedModule() {
  if (!markedModulePromise) {
    markedModulePromise = import(markdownModuleUrl);
  }
  return markedModulePromise;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let value = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(value);
      value = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += character;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function formatShortDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function formatLongDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
