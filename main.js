"use strict";

/* =========================================================
 * GitHub Newsletter – frontend
 *
 * Renders data/issues.json and data/prs.json with theme switching
 * (light / dark / colorful), live filtering, and accessible tab
 * navigation. All GitHub-sourced strings are inserted via
 * textContent / createElement, never innerHTML, to defend against
 * XSS from a malicious issue body.
 * ========================================================= */

const THEME_KEY = "newsletter-theme";
const TABS_KEY = "newsletter-active-tab";
const VALID_THEMES = ["light", "dark", "colorful"];

const SECTIONS = {
  issues: {
    id: "issues",
    kind: "issue",
    label: "Issue",
    empty: "No new issues in the last 24 hours.",
  },
  prs: {
    id: "prs",
    kind: "pr",
    label: "PR",
    empty: "No new pull requests in the last 24 hours.",
  },
};

// In-memory store so the search box can filter without re-fetching.
const store = { issues: [], prs: [] };

/* ---------- Helpers ---------- */

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(user) {
  if (!user) return "?";
  return user.slice(0, 1).toUpperCase();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/* ---------- Rendering ---------- */

function renderCard(item, kind) {
  const card = el("article", { class: "card" });

  const top = el("div", { class: "card-top" },
    el("span", { class: "card-repo", text: item.repo || "" }),
    el("span", { class: `card-kind ${kind}` },
      el("span", { class: "dot" }),
      SECTIONS[kind === "issue" ? "issues" : "prs"].label,
    ),
  );
  card.appendChild(top);

  const link = el("a", {
    class: "card-title",
    href: item.url || "#",
    target: "_blank",
    rel: "noopener noreferrer",
    text: item.title || "(untitled)",
  });
  card.appendChild(link);

  const created = item.created_at;
  const meta = el("div", { class: "card-meta" },
    el("span", { class: "avatar", text: initials(item.user), "aria-hidden": "true" }),
    el("span", { text: item.user ? `@${item.user}` : "unknown" }),
    el("span", { class: "card-meta-sep", text: "·" }),
    el("time", { datetime: created || "", title: created || "", text: formatDate(created) }),
  );
  card.appendChild(meta);

  if (item.body) {
    card.appendChild(el("p", { class: "card-body", text: item.body }));
  }

  return card;
}

function renderSkeleton(container, count = 4) {
  const list = el("div", { class: "skeleton-list" });
  for (let i = 0; i < count; i++) list.appendChild(el("div", { class: "skeleton" }));
  container.replaceChildren(list);
}

function renderEmpty(container, message, kind = "empty") {
  container.replaceChildren(
    el("p", { class: `status status-${kind}`, role: kind === "error" ? "alert" : null, text: message }),
  );
}

function matchesQuery(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (item.repo || "").toLowerCase().includes(q) ||
    (item.title || "").toLowerCase().includes(q) ||
    (item.user || "").toLowerCase().includes(q) ||
    (item.body || "").toLowerCase().includes(q)
  );
}

function renderList(sectionKey) {
  const config = SECTIONS[sectionKey];
  const container = document.getElementById(config.id);
  if (!container) return;

  const query = (document.getElementById("search")?.value || "").trim();
  const data = store[sectionKey] || [];
  const filtered = data.filter((item) => matchesQuery(item, query));

  const countEl = document.getElementById(`${sectionKey}-count`);
  if (countEl) countEl.textContent = String(filtered.length);

  if (filtered.length === 0) {
    renderEmpty(container, query ? "No matches for your search." : config.empty);
    return;
  }

  const list = el("div", { class: "panel-list" });
  for (const item of filtered) list.appendChild(renderCard(item, config.kind));
  container.replaceChildren(list);
}

/* ---------- Data loading ---------- */

async function loadSection(sectionKey) {
  const config = SECTIONS[sectionKey];
  const container = document.getElementById(config.id);
  if (!container) return;

  renderSkeleton(container);

  try {
    const res = await fetch(`data/${sectionKey}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    store[sectionKey] = Array.isArray(data) ? data : [];
  } catch (err) {
    store[sectionKey] = [];
    renderEmpty(container, `Could not load ${sectionKey}: ${err.message}`, "error");
    const countEl = document.getElementById(`${sectionKey}-count`);
    if (countEl) countEl.textContent = "0";
    return;
  }

  renderList(sectionKey);
}

/* ---------- Theme switcher ---------- */

function applyTheme(theme) {
  const t = VALID_THEMES.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = t;
  for (const btn of document.querySelectorAll(".theme-btn")) {
    btn.setAttribute("aria-checked", btn.dataset.themeValue === t ? "true" : "false");
  }
  try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
}

function initTheme() {
  let saved;
  try { saved = localStorage.getItem(THEME_KEY); } catch { saved = null; }
  if (!saved) {
    saved = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  applyTheme(saved);

  for (const btn of document.querySelectorAll(".theme-btn")) {
    btn.addEventListener("click", () => applyTheme(btn.dataset.themeValue));
  }

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
    let stored;
    try { stored = localStorage.getItem(THEME_KEY); } catch { stored = null; }
    if (!stored) applyTheme(e.matches ? "dark" : "light");
  });
}

/* ---------- Tabs ---------- */

function activateTab(target) {
  for (const tab of document.querySelectorAll(".tab")) {
    const isActive = tab.dataset.target === target;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  for (const panel of document.querySelectorAll(".panel")) {
    const isActive = panel.id === target;
    panel.classList.toggle("is-active", isActive);
    if (isActive) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  }
  try { localStorage.setItem(TABS_KEY, target); } catch { /* ignore */ }
}

function initTabs() {
  let saved;
  try { saved = localStorage.getItem(TABS_KEY); } catch { saved = null; }
  if (saved && SECTIONS[saved]) activateTab(saved);

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => activateTab(tab.dataset.target));
  }
}

/* ---------- Search ---------- */

function initSearch() {
  const input = document.getElementById("search");
  if (!input) return;
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      renderList("issues");
      renderList("prs");
    }, 120);
  });
}

/* ---------- Boot ---------- */

function init() {
  initTheme();
  initTabs();
  initSearch();
  loadSection("issues");
  loadSection("prs");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}