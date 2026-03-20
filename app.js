const DEFAULT_MAX_RENDER = 1000;
const RENDER_CHUNK_SIZE = 450;
const SORT_MODES = {
  ALPHA_ASC: "alpha-asc",
  ALPHA_DESC: "alpha-desc",
  LENGTH_ASC: "length-asc",
  LENGTH_DESC: "length-desc"
};

const FLOW_MODES = {
  COLUMN_FLOW: "column-flow",
  ROW_FLOW: "row-flow"
};

const GLOBAL_TYPE_ANYWHERE_ENABLED = !isPhoneOrTabletDevice();

const STORAGE_KEYS = {
  SORT_MODE: "prefixFinder.sortMode",
  FLOW_MODE: "prefixFinder.flowMode"
};

const elements = {
  solverLayout: document.getElementById("solverLayout"),
  dictionarySize: document.getElementById("dictionarySize"),
  settingsToggleBtn: document.getElementById("settingsToggleBtn"),
  settingsMenu: document.getElementById("settingsMenu"),
  prefixInput: document.getElementById("prefixInput"),
  clearBtn: document.getElementById("clearBtn"),
  sortSelect: document.getElementById("sortSelect"),
  maxShownSelect: document.getElementById("maxShownSelect"),
  flowToggleBtn: document.getElementById("flowToggleBtn"),
  matchCount: document.getElementById("matchCount"),
  renderCount: document.getElementById("renderCount"),
  statusTag: document.getElementById("statusTag"),
  renderNote: document.getElementById("renderNote"),
  results: document.getElementById("results")
};

const state = {
  words: [],
  wordsInFileOrder: [],
  wordsByLength: [],
  availableLengths: [],
  availableLengthsDesc: [],
  prefix: "",
  sortMode: SORT_MODES.LENGTH_ASC,
  maxRender: DEFAULT_MAX_RENDER,
  flowMode: FLOW_MODES.ROW_FLOW,
  settingsOpen: false,
  ready: false,
  renderJobId: 0
};

start();

async function start() {
  loadPreferences();
  bindEvents();
  await loadWordList();
  updateView();
}

function bindEvents() {
  document.addEventListener("keydown", onGlobalKeydown);
  document.addEventListener("click", onDocumentClick);
  elements.prefixInput.addEventListener("input", onPrefixInput);
  elements.settingsToggleBtn.addEventListener("click", onSettingsToggleClick);
  elements.sortSelect.addEventListener("change", onSortChange);
  elements.maxShownSelect.addEventListener("change", onMaxShownChange);
  elements.flowToggleBtn.addEventListener("click", onFlowToggle);

  elements.clearBtn.addEventListener("click", () => {
    state.prefix = "";
    updateView();
  });

}

function onSettingsToggleClick() {
  setSettingsOpen(!state.settingsOpen);
}

function onDocumentClick(event) {
  if (!state.settingsOpen) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (elements.settingsMenu.contains(target) || elements.settingsToggleBtn.contains(target)) {
    return;
  }

  setSettingsOpen(false);
}

function setSettingsOpen(isOpen) {
  state.settingsOpen = Boolean(isOpen);
  document.body.classList.toggle("settings-open", state.settingsOpen);
  elements.solverLayout.classList.toggle("settings-open", state.settingsOpen);
  elements.settingsToggleBtn.classList.toggle("active", state.settingsOpen);
  elements.settingsToggleBtn.setAttribute("aria-expanded", String(state.settingsOpen));
  elements.settingsMenu.setAttribute("aria-hidden", String(!state.settingsOpen));
}

function onPrefixInput(event) {
  const cleaned = event.target.value.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned !== state.prefix) {
    state.prefix = cleaned;
    updateView();
    return;
  }

  event.target.value = state.prefix.toUpperCase();
}

function onSortChange(event) {
  const nextMode = event.target.value;

  if (!Object.values(SORT_MODES).includes(nextMode)) {
    event.target.value = state.sortMode;
    return;
  }

  if (nextMode !== state.sortMode) {
    state.sortMode = nextMode;
    persistPreferences();
    updateView();
  }
}

function onMaxShownChange(event) {
  const parsed = Number.parseInt(event.target.value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    event.target.value = String(state.maxRender);
    return;
  }

  if (parsed !== state.maxRender) {
    state.maxRender = parsed;
    updateView();
  }
}

function onFlowToggle() {
  state.flowMode =
    state.flowMode === FLOW_MODES.COLUMN_FLOW
      ? FLOW_MODES.ROW_FLOW
      : FLOW_MODES.COLUMN_FLOW;

  persistPreferences();
  applyResultsFlowMode();
  updateView();
}

async function loadWordList() {
  try {
    const response = await fetch("words.txt");
    if (!response.ok) {
      throw new Error("Failed to load words.txt");
    }

    const text = await response.text();
    const source = text.split(/\r?\n/);

    for (let i = 0; i < source.length; i += 1) {
      const word = source[i].trim().toLowerCase();
      if (!word || !/^[a-z]+$/.test(word)) {
        continue;
      }

      state.wordsInFileOrder.push(word);
      state.words.push(word);
    }

    state.words.sort();
    buildLengthBuckets();

    state.ready = true;
    elements.dictionarySize.textContent = `${formatNumber(state.words.length)} words`;
    elements.statusTag.textContent = "ready";
    elements.statusTag.classList.add("ready");
  } catch (error) {
    elements.dictionarySize.textContent = "load error";
    elements.statusTag.textContent = "error";
    elements.renderNote.textContent = "Could not load the dictionary file. Keep words.txt beside index.html.";
    console.error(error);
  }
}

function buildLengthBuckets() {
  state.wordsByLength = [];

  for (let i = 0; i < state.wordsInFileOrder.length; i += 1) {
    const word = state.wordsInFileOrder[i];
    const length = word.length;

    if (!state.wordsByLength[length]) {
      state.wordsByLength[length] = [];
    }

    state.wordsByLength[length].push(word);
  }

  state.availableLengths = [];
  for (let i = 0; i < state.wordsByLength.length; i += 1) {
    if (state.wordsByLength[i] && state.wordsByLength[i].length > 0) {
      state.availableLengths.push(i);
    }
  }

  state.availableLengthsDesc = state.availableLengths.slice().reverse();
}

function onGlobalKeydown(event) {
  if (!state.ready) {
    return;
  }

  if (
    !isPhoneOrTabletDevice() &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !isTypingContext(event.target) &&
    event.key.toLowerCase() === "t"
  ) {
    setSettingsOpen(!state.settingsOpen);
    event.preventDefault();
    return;
  }

  if (event.key === "Escape" && state.settingsOpen) {
    setSettingsOpen(false);
    event.preventDefault();
    return;
  }

  if (!GLOBAL_TYPE_ANYWHERE_ENABLED && isTypingContext(event.target)) {
    return;
  }

  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const key = event.key;

  if (/^[a-zA-Z]$/.test(key)) {
    state.prefix += key.toLowerCase();
    event.preventDefault();
    updateView();
    return;
  }

  if (key === "Backspace") {
    if (state.prefix.length > 0) {
      state.prefix = state.prefix.slice(0, -1);
      updateView();
    }
    event.preventDefault();
    return;
  }

  if (key === "Escape") {
    if (state.prefix.length > 0) {
      state.prefix = "";
      updateView();
    }
    event.preventDefault();
    return;
  }

  if (key === " " || key === "Spacebar") {
    if (state.prefix.length > 0) {
      state.prefix = "";
      updateView();
    }
    event.preventDefault();
  }
}

function isTypingContext(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function updateView() {
  state.renderJobId += 1;
  const activeRenderJob = state.renderJobId;

  const selectedSortMode = elements.sortSelect.value;
  if (Object.values(SORT_MODES).includes(selectedSortMode)) {
    state.sortMode = selectedSortMode;
  }

  const selectedMaxShown = Number.parseInt(elements.maxShownSelect.value, 10);
  if (Number.isFinite(selectedMaxShown) && selectedMaxShown > 0) {
    state.maxRender = selectedMaxShown;
  }

  elements.prefixInput.value = state.prefix.toUpperCase();
  elements.sortSelect.value = state.sortMode;
  elements.maxShownSelect.value = String(state.maxRender);
  elements.flowToggleBtn.textContent = getFlowLabel(state.flowMode);
  elements.flowToggleBtn.setAttribute(
    "aria-pressed",
    String(state.flowMode === FLOW_MODES.ROW_FLOW)
  );
  applyResultsFlowMode();

  if (!state.ready) {
    elements.matchCount.textContent = getMatchesLabel(0);
    elements.renderCount.textContent = getShownLabel(0);
    elements.renderNote.textContent = "Loading dictionary...";
    elements.results.innerHTML = "";
    return;
  }

  if (!state.prefix) {
    elements.matchCount.textContent = getMatchesLabel(state.words.length);
    elements.renderCount.textContent = getShownLabel(0);
    elements.renderNote.textContent = GLOBAL_TYPE_ANYWHERE_ENABLED
      ? `Type letters anywhere to filter. Example: C, then A, then T. Sort: ${getSortLabel(state.sortMode)}.`
      : `Tap the input box to type letters. Example: C, then A, then T. Sort: ${getSortLabel(state.sortMode)}.`;
    elements.results.innerHTML = "";
    return;
  }

  const range = findPrefixRange(state.prefix);
  const totalMatches = range.end - range.start;
  const shownMatches = Math.min(totalMatches, state.maxRender);
  const wordsToRender = collectVisibleMatches(state.prefix, range, shownMatches);

  elements.matchCount.textContent = getMatchesLabel(totalMatches);
  elements.renderCount.textContent = getShownLabel(shownMatches);

  if (totalMatches > state.maxRender) {
    elements.renderNote.textContent = `Showing first ${formatNumber(state.maxRender)} of ${formatNumber(totalMatches)} matches (${getSortLabel(state.sortMode)}). Type more letters to narrow.`;
  } else {
    elements.renderNote.textContent = `${formatNumber(totalMatches)} match${totalMatches === 1 ? "" : "es"} for ${state.prefix.toUpperCase()} (${getSortLabel(state.sortMode)}).`;
  }

  renderWordList(wordsToRender, activeRenderJob);
}

function findPrefixRange(prefix) {
  const lowerPrefix = prefix.toLowerCase();
  const start = lowerBound(state.words, lowerPrefix);
  const end = lowerBound(state.words, `${lowerPrefix}{`);
  return { start, end };
}

function collectVisibleMatches(prefix, range, count) {
  if (count === 0) {
    return [];
  }

  if (state.sortMode === SORT_MODES.ALPHA_ASC) {
    return state.words.slice(range.start, range.start + count);
  }

  if (state.sortMode === SORT_MODES.ALPHA_DESC) {
    const words = new Array(count);

    for (let i = 0; i < count; i += 1) {
      words[i] = state.words[range.end - 1 - i];
    }

    return words;
  }

  const words = [];
  const descending = state.sortMode === SORT_MODES.LENGTH_DESC;
  const lengths = descending ? state.availableLengthsDesc : state.availableLengths;

  for (let i = 0; i < lengths.length; i += 1) {
    if (words.length >= count) {
      break;
    }

    const length = lengths[i];
    const bucket = state.wordsByLength[length];
    if (!bucket || bucket.length === 0) {
      continue;
    }

    for (let j = 0; j < bucket.length; j += 1) {
      const candidate = bucket[j];
      if (candidate.startsWith(prefix)) {
        words.push(candidate);

        if (words.length >= count) {
          break;
        }
      }
    }
  }

  return words;
}

function renderWordList(words, renderJobId) {
  if (words.length === 0) {
    elements.results.innerHTML = '<div class="word-item">No matches.</div>';
    return;
  }

  elements.results.innerHTML = "";

  let cursor = 0;

  const appendChunk = () => {
    if (renderJobId !== state.renderJobId) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const stop = Math.min(cursor + RENDER_CHUNK_SIZE, words.length);

    for (let i = cursor; i < stop; i += 1) {
      const word = words[i];
      const item = document.createElement("div");
      item.className = "word-item";
      setWordItemContent(item, word);
      fragment.appendChild(item);
    }

    elements.results.appendChild(fragment);
    cursor = stop;

    if (cursor < words.length) {
      requestAnimationFrame(appendChunk);
    }
  };

  requestAnimationFrame(appendChunk);
}

function setWordItemContent(element, word) {
  const BREAK_CHUNK = 12;

  if (word.length <= BREAK_CHUNK) {
    element.textContent = word;
    return;
  }

  for (let i = 0; i < word.length; i += BREAK_CHUNK) {
    element.appendChild(document.createTextNode(word.slice(i, i + BREAK_CHUNK)));

    if (i + BREAK_CHUNK < word.length) {
      element.appendChild(document.createElement("wbr"));
    }
  }
}

function lowerBound(array, target) {
  let left = 0;
  let right = array.length;

  while (left < right) {
    const mid = (left + right) >> 1;
    if (array[mid] < target) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getMatchesLabel(value) {
  const formatted = formatNumber(value);
  return `${formatted} match${value === 1 ? "" : "es"}`;
}

function getShownLabel(value) {
  return `${formatNumber(value)} shown`;
}

function applyResultsFlowMode() {
  elements.results.classList.toggle("row-flow", state.flowMode === FLOW_MODES.ROW_FLOW);
}

function getSortLabel(sortMode) {
  if (sortMode === SORT_MODES.ALPHA_DESC) {
    return "Z to A";
  }

  if (sortMode === SORT_MODES.LENGTH_ASC) {
    return "Length: Short to Long";
  }

  if (sortMode === SORT_MODES.LENGTH_DESC) {
    return "Length: Long to Short";
  }

  return "A to Z";
}

function getFlowLabel(flowMode) {
  if (flowMode === FLOW_MODES.ROW_FLOW) {
    return "Order: Left-Right";
  }

  return "Order: Top-Down";
}

function loadPreferences() {
  try {
    const storedSortMode = localStorage.getItem(STORAGE_KEYS.SORT_MODE);
    if (storedSortMode && Object.values(SORT_MODES).includes(storedSortMode)) {
      state.sortMode = storedSortMode;
      elements.sortSelect.value = storedSortMode;
    }

    const storedFlowMode = localStorage.getItem(STORAGE_KEYS.FLOW_MODE);
    if (storedFlowMode && Object.values(FLOW_MODES).includes(storedFlowMode)) {
      state.flowMode = storedFlowMode;
    }
  } catch (error) {
    // Ignore storage errors (private mode, blocked storage, etc.)
  }
}

function persistPreferences() {
  try {
    localStorage.setItem(STORAGE_KEYS.SORT_MODE, state.sortMode);
    localStorage.setItem(STORAGE_KEYS.FLOW_MODE, state.flowMode);
  } catch (error) {
    // Ignore storage errors (private mode, blocked storage, etc.)
  }
}

function isPhoneOrTabletDevice() {
  const userAgent = navigator.userAgent || "";
  const iOSDevice = /iPhone|iPad|iPod/i.test(userAgent);
  const androidDevice = /Android/i.test(userAgent);
  const iPadOSDesktopUA = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return iOSDevice || androidDevice || iPadOSDesktopUA;
}
