import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/**
 * ComfyUI Clean Templates Extension - Store-Level Reactive Architecture v4.2
 * - Robust Pinia store discovery via Vue App root (#vue-app.__vue_app__) & component tree
 * - Explicit "🔍 Applica filtri" button + real-time change triggers
 * - Category Checkboxes in OR: ComfyUI Workflow (crown), Partner (logo), Free (local)
 * - Minimum 1 category checkbox active at all times
 * - Concat with Models filter in AND (OR among selected models/families)
 * - Predefined Model Families (Flux, Wan, MiniMax, Qwen, SDXL, etc.) matching all sub-variants
 * - Native Vue Lazy Pagination & infinite scroll preserved intact (zero DOM hiding, zero flickering)
 * - Accurate counter: displayed matching templates of total templates
 */

const EXTENSION_NAME = "ComfyUI.CleanTemplates";
const STORAGE_KEY = "comfyui_clean_templates_prefs_v4";

// ---------------------------------------------------------------------------
// Internationalization (i18n) - English (Default) & Italian
// ---------------------------------------------------------------------------
const I18N = {
  en: {
    comfyWorkflow: "👑 ComfyUI Workflow",
    comfyTooltip: "Show workflows requiring ComfyUI credits / API",
    partner: "🤝 Partner",
    partnerTooltip: "Show commercial partner workflows",
    free: "✓ Free",
    freeTooltip: "Show free, local open-source workflows",
    sortLabel: "Sort:",
    sortNewest: "📅 Date (Newest)",
    sortAlphabetical: "🔤 Alphabetical (A-Z)",
    sortPopular: "🔥 Popular",
    modelsLabel: "Models:",
    allModels: "All models",
    modelsSelected: (count) => `Models (${count} selected)`,
    searchModelPlaceholder: "Search model or family...",
    selectAll: "All",
    deselectAll: "Deselect",
    closeBtn: "Close",
    mainFamiliesHeader: "🔥 Main Families",
    allModelTagsHeader: "🏷️ All Model Tags",
    resultsCount: (count, total) => `Showing: ${count} of ${total} total templates`,
  },
  it: {
    comfyWorkflow: "👑 ComfyUI Workflow",
    comfyTooltip: "Mostra workflow con coroncina (ComfyUI / Crediti)",
    partner: "🤝 Partner",
    partnerTooltip: "Mostra workflow di partner commerciali",
    free: "✓ Free",
    freeTooltip: "Mostra workflow gratuiti e open source locali",
    sortLabel: "Ordina:",
    sortNewest: "📅 Data (più recenti)",
    sortAlphabetical: "🔤 Alfabetico (A-Z)",
    sortPopular: "🔥 Popolari",
    modelsLabel: "Modelli:",
    allModels: "Tutti i modelli",
    modelsSelected: (count) => `Modelli (${count} selezionati)`,
    searchModelPlaceholder: "Cerca modello o famiglia...",
    selectAll: "Tutti",
    deselectAll: "Deseleziona",
    closeBtn: "Chiudi",
    mainFamiliesHeader: "🔥 Famiglie Principali",
    allModelTagsHeader: "🏷️ Tutti i Tag Modello",
    resultsCount: (count, total) => `Visualizzati: ${count} di ${total} template totali`,
  },
};

function isItalian() {
  try {
    const setting = app.ui?.settings?.getSettingValue?.("Comfy.Locale");
    if (typeof setting === "string") return setting.toLowerCase().startsWith("it");
    const raw = localStorage.getItem("Comfy.Locale") || localStorage.getItem("Comfy.Settings.Comfy.Locale");
    if (raw && typeof raw === "string" && raw.toLowerCase().includes("it")) return true;
    if (document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith("it")) return true;
  } catch (_) {}
  return false;
}

function t(key, ...args) {
  const lang = isItalian() ? "it" : "en";
  const val = I18N[lang]?.[key] ?? I18N.en[key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}

// Inject CSS stylesheet
try {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = new URL("./clean_templates.css", import.meta.url).href;
  document.head.appendChild(link);
} catch (err) {
  console.warn(`[${EXTENSION_NAME}] Failed to load CSS:`, err);
}

// ---------------------------------------------------------------------------
// Model Families Definition (Clean grouping for matching all variants)
// ---------------------------------------------------------------------------
const MODEL_FAMILIES = [
  { id: "family:flux", label: "Flux (All)", keywords: ["flux"] },
  { id: "family:wan", label: "Wan Video (All)", keywords: ["wan"] },
  { id: "family:minimax", label: "MiniMax (All)", keywords: ["minimax"] },
  { id: "family:qwen", label: "Qwen (All)", keywords: ["qwen"] },
  { id: "family:sdxl", label: "SDXL", keywords: ["sdxl"] },
  { id: "family:sd15", label: "SD 1.5", keywords: ["sd1.5", "sd 1.5"] },
  { id: "family:sd3", label: "SD 3 / 3.5", keywords: ["sd3", "sd 3"] },
  { id: "family:hunyuan", label: "Hunyuan (All)", keywords: ["hunyuan"] },
  { id: "family:ltx", label: "LTX Video", keywords: ["ltx"] },
  { id: "family:kling", label: "Kling", keywords: ["kling"] },
  { id: "family:recraft", label: "Recraft", keywords: ["recraft"] },
  { id: "family:luma", label: "Luma", keywords: ["luma"] },
  { id: "family:runway", label: "Runway", keywords: ["runway"] },
  { id: "family:pixverse", label: "PixVerse", keywords: ["pixverse"] },
  { id: "family:tripo", label: "Tripo 3D", keywords: ["tripo"] },
  { id: "family:vidu", label: "Vidu", keywords: ["vidu"] },
  { id: "family:grok", label: "Grok", keywords: ["grok"] },
  { id: "family:gemini", label: "Google / Gemini", keywords: ["gemini", "google"] },
  { id: "family:openai", label: "OpenAI / GPT", keywords: ["openai", "chatgpt", "gpt"] },
  { id: "family:seedance", label: "Seedance / Seedream", keywords: ["seedance", "seedream"] },
  { id: "family:anima", label: "Anima", keywords: ["anima"] },
  { id: "family:birefnet", label: "BiRefNet", keywords: ["birefnet"] },
  { id: "family:depth_anything", label: "Depth Anything", keywords: ["depth anything"] },
  { id: "family:upscale", label: "Real-ESRGAN / Upscale", keywords: ["esrgan", "upscale"] },
];

// Raw categories cache & metadata
let originalRawCategories = null;
const allUniqueRawTemplatesMap = new Map();
const allUniqueModelTags = new Set();
let currentMatchingCount = 0;

// Preferences management
function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.showComfy && !parsed.showPartner && !parsed.showFree) {
        parsed.showFree = true;
      }
      return parsed;
    }
  } catch (e) {
    // Ignore parse error
  }
  return {
    showComfy: false,
    showPartner: false,
    showFree: true,
    sortBy: "newest",
    selectedModels: [],
  };
}

let userPrefs = loadPreferences();

function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPrefs));
  } catch (e) {
    // Ignore storage quota error
  }
}

// ---------------------------------------------------------------------------
// Classification & Matching Helpers
// ---------------------------------------------------------------------------
function isCrownTemplate(item) {
  return (
    item.openSource === false ||
    (Array.isArray(item.tags) && item.tags.some((t) => String(t).toLowerCase() === "api")) ||
    (typeof item.name === "string" && item.name.startsWith("api_"))
  );
}

function isPartnerTemplate(item) {
  return Array.isArray(item.logos) && item.logos.length > 0;
}

function isFreeTemplate(item) {
  return !isCrownTemplate(item);
}

function getSearchableItemText(item) {
  const models = Array.isArray(item.models) ? item.models.join(" ") : "";
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  return `${item.name || ""} ${item.title || ""} ${models} ${tags}`.toLowerCase();
}

function itemMatchesModelId(item, modelId) {
  const text = getSearchableItemText(item);
  if (modelId.startsWith("family:")) {
    const fam = MODEL_FAMILIES.find((f) => f.id === modelId);
    if (fam) {
      return fam.keywords.some((kw) => text.includes(kw.toLowerCase()));
    }
  }
  // Single tag matching
  const lowerId = modelId.toLowerCase();
  if (Array.isArray(item.models) && item.models.some((m) => m.toLowerCase() === lowerId)) {
    return true;
  }
  return text.includes(lowerId);
}

function itemMatchesSelectedModels(item, selectedModels) {
  if (!selectedModels || selectedModels.length === 0) return true;
  // OR among selected models
  return selectedModels.some((mId) => itemMatchesModelId(item, mId));
}

// Populate metadata
function initMetadata(categories) {
  if (!Array.isArray(categories)) return;
  categories.forEach((cat) => {
    (cat.templates || []).forEach((t) => {
      if (t && t.name) {
        allUniqueRawTemplatesMap.set(t.name, t);
        if (Array.isArray(t.models)) {
          t.models.forEach((m) => {
            if (m && typeof m === "string" && m.trim().length > 0) {
              allUniqueModelTags.add(m.trim());
            }
          });
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Filtering and Sorting Engine (Applied to raw categories before Vue store)
// ---------------------------------------------------------------------------
function getFilteredAndSortedCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) return rawCategories;

  const showComfy = userPrefs.showComfy;
  const showPartner = userPrefs.showPartner;
  const showFree = userPrefs.showFree;
  const sortBy = userPrefs.sortBy;
  const selectedModels = userPrefs.selectedModels || [];

  const matchingNames = new Set();

  const filtered = rawCategories.map((cat) => {
    const originalTemplates = cat.templates || [];

    const matchingTemplates = originalTemplates.filter((item) => {
      const hasCrown = isCrownTemplate(item);
      const hasPartner = isPartnerTemplate(item);
      const isFree = isFreeTemplate(item);

      // 1. OR Logic across the 3 categories
      let categoryMatch = false;
      if (showComfy && hasCrown) categoryMatch = true;
      if (showPartner && hasPartner) categoryMatch = true;
      if (showFree && isFree) categoryMatch = true;

      if (!categoryMatch) return false;

      // 2. AND Logic with Model filter
      if (!itemMatchesSelectedModels(item, selectedModels)) {
        return false;
      }

      if (item.name) matchingNames.add(item.name);
      return true;
    });

    // 3. Sorting
    const sorted = [...matchingTemplates];
    if (sortBy === "newest") {
      sorted.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
    } else if (sortBy === "alphabetical") {
      sorted.sort((a, b) => {
        const titleA = (a.title || a.name || "").toLowerCase();
        const titleB = (b.title || b.name || "").toLowerCase();
        return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: "base" });
      });
    } else if (sortBy === "popular") {
      sorted.sort((a, b) => (b.usage || 0) - (a.usage || 0));
    }

    return {
      ...cat,
      templates: sorted,
    };
  });

  currentMatchingCount = matchingNames.size;
  return filtered;
}

// ---------------------------------------------------------------------------
// Safe Direct Fetch of /templates/index.json (bypasses 404 recursion on index.it.json)
// ---------------------------------------------------------------------------
async function fetchRawCategories() {
  if (originalRawCategories && originalRawCategories.length > 0) {
    return originalRawCategories;
  }
  try {
    const res = await fetch("/templates/index.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        originalRawCategories = JSON.parse(JSON.stringify(data));
        initMetadata(originalRawCategories);
        updateModelDropdownItems();
        return originalRawCategories;
      }
    }
  } catch (err) {
    console.warn(`[${EXTENSION_NAME}] Direct fetch of index.json failed:`, err);
  }
  return null;
}

// Hook api.getCoreWorkflowTemplates across all possible references
let originalGetCore = null;

function hookApi() {
  const targetApi = window.comfyAPI?.api?.api || api;
  const ComfyApiProto = window.comfyAPI?.api?.ComfyApi?.prototype;

  if (targetApi && typeof targetApi.getCoreWorkflowTemplates === "function" && !originalGetCore) {
    originalGetCore = targetApi.getCoreWorkflowTemplates.bind(targetApi);
  }

  const hookFn = async function (locale) {
    let raw = await fetchRawCategories();
    if (!raw && typeof originalGetCore === "function") {
      try {
        const fetched = await originalGetCore("en");
        if (Array.isArray(fetched) && fetched.length > 0) {
          originalRawCategories = JSON.parse(JSON.stringify(fetched));
          initMetadata(originalRawCategories);
          raw = originalRawCategories;
        }
      } catch (err) {
        console.error(`[${EXTENSION_NAME}] Fallback fetch failed:`, err);
      }
    }
    return getFilteredAndSortedCategories(raw || []);
  };

  if (targetApi) {
    targetApi.getCoreWorkflowTemplates = hookFn;
  }
  if (ComfyApiProto) {
    ComfyApiProto.getCoreWorkflowTemplates = hookFn;
  }
}

// Initialize hook and pre-fetch raw categories immediately
hookApi();
fetchRawCategories();

// ---------------------------------------------------------------------------
// Pinia Store & Vue App Discovery (Multi-method: Root, provides, component tree)
// ---------------------------------------------------------------------------
function getPinia() {
  // Method 1: Root #vue-app element
  const root = document.getElementById("vue-app") || document.querySelector("#vue-app");
  if (root?.__vue_app__) {
    const vueApp = root.__vue_app__;
    if (vueApp.config?.globalProperties?.$pinia) {
      return vueApp.config.globalProperties.$pinia;
    }
    if (vueApp._context?.provides) {
      const symbols = Object.getOwnPropertySymbols(vueApp._context.provides);
      for (const s of symbols) {
        const val = vueApp._context.provides[s];
        if (val && val._s && typeof val._s.get === "function") {
          return val;
        }
      }
    }
  }

  // Method 2: Check any element with __vue_app__
  const allWithApp = document.querySelectorAll("[data-v-app], #vue-app, body > *");
  for (const el of allWithApp) {
    if (el.__vue_app__) {
      const vueApp = el.__vue_app__;
      if (vueApp.config?.globalProperties?.$pinia) {
        return vueApp.config.globalProperties.$pinia;
      }
      if (vueApp._context?.provides) {
        const symbols = Object.getOwnPropertySymbols(vueApp._context.provides);
        for (const s of symbols) {
          const val = vueApp._context.provides[s];
          if (val && val._s && typeof val._s.get === "function") {
            return val;
          }
        }
      }
    }
  }

  // Method 3: comfyApp instance
  const comfyApp = window.comfyAPI?.app?.app || app;
  if (comfyApp?.vueApp) {
    if (comfyApp.vueApp.config?.globalProperties?.$pinia) {
      return comfyApp.vueApp.config.globalProperties.$pinia;
    }
    if (comfyApp.vueApp._context?.provides) {
      const symbols = Object.getOwnPropertySymbols(comfyApp.vueApp._context.provides);
      for (const s of symbols) {
        const val = comfyApp.vueApp._context.provides[s];
        if (val && val._s && typeof val._s.get === "function") {
          return val;
        }
      }
    }
  }

  // Method 4: Globals
  if (window.$pinia) return window.$pinia;
  if (window.__PINIA__) return window.__PINIA__;

  return null;
}

function findDialogComponent(vnode) {
  if (!vnode) return null;
  const comp = vnode.component;
  if (comp) {
    const name = comp.type?.__name || comp.type?.name;
    if (name === "WorkflowTemplateSelectorDialog") return comp;
    if (comp.setupState && typeof comp.setupState.filterTemplatesByCategory === "function") return comp;
    if (comp.subTree) {
      const found = findDialogComponent(comp.subTree);
      if (found) return found;
    }
  }
  if (Array.isArray(vnode.dynamicChildren)) {
    for (const child of vnode.dynamicChildren) {
      if (child && typeof child === "object") {
        const found = findDialogComponent(child);
        if (found) return found;
      }
    }
  }
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (child && typeof child === "object") {
        const found = findDialogComponent(child);
        if (found) return found;
      }
    }
  }
  return null;
}

function getWorkflowTemplatesStore() {
  const pinia = getPinia();
  if (pinia?._s?.get?.("workflowTemplates")) {
    return pinia._s.get("workflowTemplates");
  }

  // Fallback: Check dialog component setupState
  const root = document.getElementById("vue-app") || document.querySelector("#vue-app");
  const vueApp = root?.__vue_app__;
  if (vueApp?._instance?.subTree) {
    const comp = findDialogComponent(vueApp._instance.subTree);
    if (comp?.setupState?.i && typeof comp.setupState.i.loadWorkflowTemplates === "function") {
      return comp.setupState.i;
    }
  }

  return null;
}

async function reloadWorkflowTemplatesStore() {
  savePreferences();
  updateModelDropdownButtonText();

  // Re-verify API hook
  hookApi();

  const store = getWorkflowTemplatesStore();
  const root = document.getElementById("vue-app") || document.querySelector("#vue-app");
  const vueApp = root?.__vue_app__;
  const comp = vueApp?._instance?.subTree ? findDialogComponent(vueApp._instance.subTree) : null;

  if (store) {
    try {
      // In Pinia reactive unwrapping, setting store.isLoaded = false sets the underlying ref i.value = false!
      store.isLoaded = false;
      if (store.$state && store.$state.isLoaded !== undefined) {
        store.$state.isLoaded = false;
      }
      if (typeof store.isLoaded === "object" && store.isLoaded !== null && "value" in store.isLoaded) {
        store.isLoaded.value = false;
      }

      await store.loadWorkflowTemplates();
    } catch (err) {
      console.warn(`[${EXTENSION_NAME}] Error reloading store:`, err);
    }
  } else {
    console.warn(`[${EXTENSION_NAME}] workflowTemplates store not found yet.`);
  }

  // Reset pagination and force card grid re-render if component is found
  if (comp?.setupState) {
    if (typeof comp.setupState.Me === "function") {
      comp.setupState.Me();
    }
    if (comp.setupState.ge) {
      comp.setupState.ge.value++;
    }
  }

  // Trigger search input dispatch to ensure Vue's watch and filtering re-evaluate
  try {
    const searchInput =
      document.querySelector('[role="dialog"] input[type="text"]') ||
      document.querySelector('.p-dialog input[type="text"]');
    if (searchInput) {
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  } catch (_) {}

  // Sync ComfyUI sort setting
  try {
    app.ui?.settings?.setSettingValue?.("Comfy.Templates.SortBy", userPrefs.sortBy);
  } catch (_) {}

  // Update footer results count
  setTimeout(updateFooterResultCount, 60);
}

// ---------------------------------------------------------------------------
// Accurate Results Counter in Dialog Footer (zero-cost, non-recursive)
// ---------------------------------------------------------------------------
function updateFooterResultCount() {
  const footerCountEl =
    document.querySelector('[role="dialog"] .mt-6.px-6.text-sm.text-muted') ||
    document.querySelector(".p-dialog .mt-6.px-6.text-sm.text-muted") ||
    document.querySelector(".mt-6.px-6.text-sm.text-muted");

  if (!footerCountEl) return;

  const total = allUniqueRawTemplatesMap.size || 566;
  const desiredText = t("resultsCount", currentMatchingCount, total);
  if (footerCountEl.textContent !== desiredText) {
    footerCountEl.textContent = desiredText;
  }
}

// ---------------------------------------------------------------------------
// Custom Toolbar UI Construction
// ---------------------------------------------------------------------------
function updateModelDropdownButtonText() {
  const btnText = document.getElementById("ct-model-btn-text");
  if (!btnText) return;

  const selected = userPrefs.selectedModels || [];
  if (selected.length === 0) {
    btnText.textContent = t("allModels");
  } else if (selected.length === 1) {
    const sId = selected[0];
    const fam = MODEL_FAMILIES.find((f) => f.id === sId);
    btnText.textContent = fam ? fam.label : sId;
  } else {
    btnText.textContent = t("modelsSelected", selected.length);
  }
}

function updateModelDropdownItems() {
  const listContainer = document.getElementById("ct-model-items-list");
  if (!listContainer) return;

  const selectedSet = new Set(userPrefs.selectedModels || []);
  listContainer.innerHTML = "";

  // 1. Group: Famiglie Principali
  const header1 = document.createElement("div");
  header1.className = "ct-section-header";
  header1.textContent = t("mainFamiliesHeader");
  listContainer.appendChild(header1);

  MODEL_FAMILIES.forEach((fam) => {
    const row = document.createElement("label");
    row.className = "ct-item-row";
    row.setAttribute("data-model", fam.label.toLowerCase() + " " + fam.keywords.join(" "));

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = fam.id;
    checkbox.checked = selectedSet.has(fam.id);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedSet.add(fam.id);
      } else {
        selectedSet.delete(fam.id);
      }
      userPrefs.selectedModels = Array.from(selectedSet);
      savePreferences();
      updateModelDropdownButtonText();
      reloadWorkflowTemplatesStore();
    });

    const span = document.createElement("span");
    span.textContent = fam.label;

    row.appendChild(checkbox);
    row.appendChild(span);
    listContainer.appendChild(row);
  });

  // 2. Group: Tutti i Tag Modello (alfabeticamente)
  if (allUniqueModelTags.size > 0) {
    const header2 = document.createElement("div");
    header2.className = "ct-section-header";
    header2.textContent = t("allModelTagsHeader");
    listContainer.appendChild(header2);

    const sortedTags = Array.from(allUniqueModelTags).sort((a, b) => a.localeCompare(b));
    sortedTags.forEach((tagName) => {
      const row = document.createElement("label");
      row.className = "ct-item-row";
      row.setAttribute("data-model", tagName.toLowerCase());

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = tagName;
      checkbox.checked = selectedSet.has(tagName);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedSet.add(tagName);
        } else {
          selectedSet.delete(tagName);
        }
        userPrefs.selectedModels = Array.from(selectedSet);
        savePreferences();
        updateModelDropdownButtonText();
        reloadWorkflowTemplatesStore();
      });

      const span = document.createElement("span");
      span.textContent = tagName;

      row.appendChild(checkbox);
      row.appendChild(span);
      listContainer.appendChild(row);
    });
  }

  updateModelDropdownButtonText();
}

function handleCategoryCheckboxChange(checkboxEl, type) {
  const currentActiveCount =
    (userPrefs.showComfy ? 1 : 0) +
    (userPrefs.showPartner ? 1 : 0) +
    (userPrefs.showFree ? 1 : 0);

  // Guard: at least 1 category checkbox must remain active
  if (!checkboxEl.checked && currentActiveCount <= 1) {
    checkboxEl.checked = true;
    return;
  }

  if (type === "comfy") userPrefs.showComfy = checkboxEl.checked;
  if (type === "partner") userPrefs.showPartner = checkboxEl.checked;
  if (type === "free") userPrefs.showFree = checkboxEl.checked;

  savePreferences();
  reloadWorkflowTemplatesStore();
}

function createToolbar() {
  const toolbar = document.createElement("div");
  toolbar.id = "clean-templates-custom-toolbar";
  toolbar.className = "clean-templates-toolbar";

  toolbar.innerHTML = `
    <div class="ct-toggle-group">
      <label class="ct-checkbox-label" title="${t("comfyTooltip")}">
        <input type="checkbox" id="ct-show-comfy" ${userPrefs.showComfy ? "checked" : ""} />
        <span class="ct-tag-crown">${t("comfyWorkflow")}</span>
      </label>
      <label class="ct-checkbox-label" title="${t("partnerTooltip")}">
        <input type="checkbox" id="ct-show-partner" ${userPrefs.showPartner ? "checked" : ""} />
        <span class="ct-tag-partner">${t("partner")}</span>
      </label>
      <label class="ct-checkbox-label" title="${t("freeTooltip")}">
        <input type="checkbox" id="ct-show-free" ${userPrefs.showFree ? "checked" : ""} />
        <span class="ct-tag-free">${t("free")}</span>
      </label>
    </div>

    <div class="ct-divider"></div>

    <div class="ct-control-group">
      <label for="ct-sort-select">${t("sortLabel")}</label>
      <select id="ct-sort-select" class="ct-select">
        <option value="newest" ${userPrefs.sortBy === "newest" ? "selected" : ""}>${t("sortNewest")}</option>
        <option value="alphabetical" ${userPrefs.sortBy === "alphabetical" ? "selected" : ""}>${t("sortAlphabetical")}</option>
        <option value="popular" ${userPrefs.sortBy === "popular" ? "selected" : ""}>${t("sortPopular")}</option>
      </select>
    </div>

    <div class="ct-divider"></div>

    <div class="ct-control-group ct-multiselect-container">
      <label>${t("modelsLabel")}</label>
      <div class="ct-multiselect">
        <button type="button" id="ct-model-dropdown-btn" class="ct-dropdown-btn">
          <span id="ct-model-btn-text">${t("allModels")}</span>
          <span class="ct-arrow">▾</span>
        </button>
        <div id="ct-model-dropdown-menu" class="ct-dropdown-menu" style="display: none;">
          <div class="ct-menu-search-bar">
            <input type="text" id="ct-model-search-input" placeholder="${t("searchModelPlaceholder")}" />
          </div>
          <div class="ct-menu-actions">
            <button type="button" id="ct-btn-select-all" class="ct-mini-btn">${t("selectAll")}</button>
            <button type="button" id="ct-btn-deselect-all" class="ct-mini-btn">${t("deselectAll")}</button>
            <button type="button" id="ct-menu-apply-btn" class="ct-mini-btn ct-mini-apply">${t("closeBtn")}</button>
          </div>
          <div id="ct-model-items-list" class="ct-items-list"></div>
        </div>
      </div>
    </div>
  `;

  // Category Checkbox Listeners
  toolbar.querySelector("#ct-show-comfy").addEventListener("change", (e) => {
    handleCategoryCheckboxChange(e.target, "comfy");
  });

  toolbar.querySelector("#ct-show-partner").addEventListener("change", (e) => {
    handleCategoryCheckboxChange(e.target, "partner");
  });

  toolbar.querySelector("#ct-show-free").addEventListener("change", (e) => {
    handleCategoryCheckboxChange(e.target, "free");
  });

  // Sort Listener
  toolbar.querySelector("#ct-sort-select").addEventListener("change", (e) => {
    userPrefs.sortBy = e.target.value;
    reloadWorkflowTemplatesStore();
  });

  // Dropdown Open / Close
  const dropdownBtn = toolbar.querySelector("#ct-model-dropdown-btn");
  const dropdownMenu = toolbar.querySelector("#ct-model-dropdown-menu");

  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdownMenu.style.display !== "none";
    dropdownMenu.style.display = isOpen ? "none" : "flex";
  });

  dropdownMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    if (dropdownMenu) dropdownMenu.style.display = "none";
  });

  // Menu Apply Button
  const menuApplyBtn = toolbar.querySelector("#ct-menu-apply-btn");
  menuApplyBtn.addEventListener("click", () => {
    if (dropdownMenu) dropdownMenu.style.display = "none";
    reloadWorkflowTemplatesStore();
  });

  // Search input inside dropdown
  const searchInput = toolbar.querySelector("#ct-model-search-input");
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const rows = toolbar.querySelectorAll(".ct-item-row");
    rows.forEach((row) => {
      const model = row.getAttribute("data-model") || "";
      row.style.display = model.includes(q) ? "flex" : "none";
    });
  });

  // Quick Action Buttons
  toolbar.querySelector("#ct-btn-select-all").addEventListener("click", () => {
    userPrefs.selectedModels = [];
    savePreferences();
    updateModelDropdownItems();
    reloadWorkflowTemplatesStore();
  });

  toolbar.querySelector("#ct-btn-deselect-all").addEventListener("click", () => {
    userPrefs.selectedModels = [];
    savePreferences();
    updateModelDropdownItems();
    reloadWorkflowTemplatesStore();
  });

  return toolbar;
}

// ---------------------------------------------------------------------------
// Toolbar Injection & Observer (Debounced & Non-intrusive)
// ---------------------------------------------------------------------------
function checkAndInjectToolbar() {
  const filterBar = document.querySelector('[data-testid="template-filter-bar"]');
  if (!filterBar) return;

  if (!document.getElementById("clean-templates-custom-toolbar")) {
    const toolbar = createToolbar();
    filterBar.appendChild(toolbar);
    updateModelDropdownItems();
  }
}

let injectDebounceTimer = null;

const modalDetectObserver = new MutationObserver(() => {
  const filterBar = document.querySelector('[data-testid="template-filter-bar"]');
  if (filterBar && !document.getElementById("clean-templates-custom-toolbar")) {
    checkAndInjectToolbar();
  }

  if (injectDebounceTimer) return;
  injectDebounceTimer = setTimeout(() => {
    injectDebounceTimer = null;
    updateFooterResultCount();
  }, 120);
});

modalDetectObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

app.registerExtension({
  name: EXTENSION_NAME,
  setup() {
    checkAndInjectToolbar();
  },
});
