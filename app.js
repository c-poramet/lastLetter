const MAX_RENDER = 25000;
const RENDER_CHUNK_SIZE = 450;

const elements = {
  dictionarySize: document.getElementById("dictionarySize"),
  prefixInput: document.getElementById("prefixInput"),
  clearBtn: document.getElementById("clearBtn"),
  focusBtn: document.getElementById("focusBtn"),
  matchCount: document.getElementById("matchCount"),
  renderCount: document.getElementById("renderCount"),
  statusTag: document.getElementById("statusTag"),
  renderNote: document.getElementById("renderNote"),
  results: document.getElementById("results")
};

const state = {
  words: [],
  prefix: "",
  ready: false,
  renderJobId: 0
};

start();

async function start() {
  bindEvents();
  await loadWordList();
  updateView();
}

function bindEvents() {
  document.addEventListener("keydown", onGlobalKeydown);
  elements.prefixInput.addEventListener("input", onPrefixInput);

  elements.clearBtn.addEventListener("click", () => {
    state.prefix = "";
    updateView();
  });

  elements.focusBtn.addEventListener("click", () => {
    elements.prefixInput.focus();
    elements.prefixInput.setSelectionRange(state.prefix.length, state.prefix.length);
  });
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

      state.words.push(word);
    }

    state.words.sort();

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

function onGlobalKeydown(event) {
  if (!state.ready) {
    return;
  }

  if (isTypingContext(event.target)) {
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

  elements.prefixInput.value = state.prefix.toUpperCase();

  if (!state.ready) {
    elements.matchCount.textContent = "0";
    elements.renderCount.textContent = "0";
    elements.renderNote.textContent = "Loading dictionary...";
    elements.results.innerHTML = "";
    return;
  }

  if (!state.prefix) {
    elements.matchCount.textContent = formatNumber(state.words.length);
    elements.renderCount.textContent = "0";
    elements.renderNote.textContent = "Type letters to filter. Example: C, then A, then T.";
    elements.results.innerHTML = "";
    return;
  }

  const range = findPrefixRange(state.prefix);
  const totalMatches = range.end - range.start;
  const shownMatches = Math.min(totalMatches, MAX_RENDER);

  elements.matchCount.textContent = formatNumber(totalMatches);
  elements.renderCount.textContent = formatNumber(shownMatches);

  if (totalMatches > MAX_RENDER) {
    elements.renderNote.textContent = `Showing first ${formatNumber(MAX_RENDER)} of ${formatNumber(totalMatches)} matches. Type more letters to narrow.`;
  } else {
    elements.renderNote.textContent = `${formatNumber(totalMatches)} match${totalMatches === 1 ? "" : "es"} for ${state.prefix.toUpperCase()}.`;
  }

  renderWordRange(range.start, shownMatches, activeRenderJob);
}

function findPrefixRange(prefix) {
  const lowerPrefix = prefix.toLowerCase();
  const start = lowerBound(state.words, lowerPrefix);
  const end = lowerBound(state.words, `${lowerPrefix}{`);
  return { start, end };
}

function renderWordRange(startIndex, count, renderJobId) {
  if (count === 0) {
    elements.results.innerHTML = '<span class="word-item">No matches.</span>';
    return;
  }

  elements.results.innerHTML = "";

  let cursor = 0;

  const appendChunk = () => {
    if (renderJobId !== state.renderJobId) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const stop = Math.min(cursor + RENDER_CHUNK_SIZE, count);

    for (let i = cursor; i < stop; i += 1) {
      const word = state.words[startIndex + i];
      const item = document.createElement("span");
      item.className = "word-item";
      item.textContent = word;
      fragment.appendChild(item);
    }

    elements.results.appendChild(fragment);
    cursor = stop;

    if (cursor < count) {
      requestAnimationFrame(appendChunk);
    }
  };

  requestAnimationFrame(appendChunk);
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