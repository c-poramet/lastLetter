const MAX_RENDER = 60000;

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
  byFirst: new Map(),
  byFirstTwo: new Map(),
  prefix: "",
  ready: false
};

start();

async function start() {
  bindEvents();
  await loadWordList();
  updateView();
}

function bindEvents() {
  document.addEventListener("keydown", onGlobalKeydown);

  elements.clearBtn.addEventListener("click", () => {
    state.prefix = "";
    updateView();
  });

  elements.focusBtn.addEventListener("click", () => {
    elements.prefixInput.focus();
  });
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
      addToIndex(state.byFirst, word.slice(0, 1), word);
      addToIndex(state.byFirstTwo, word.slice(0, 2), word);
    }

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

function addToIndex(map, key, value) {
  if (!key) {
    return;
  }

  const list = map.get(key);
  if (list) {
    list.push(value);
    return;
  }

  map.set(key, [value]);
}

function onGlobalKeydown(event) {
  if (!state.ready) {
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
  }
}

function updateView() {
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

  const matches = findMatches(state.prefix);
  const totalMatches = matches.length;
  const shownMatches = totalMatches > MAX_RENDER ? matches.slice(0, MAX_RENDER) : matches;

  elements.matchCount.textContent = formatNumber(totalMatches);
  elements.renderCount.textContent = formatNumber(shownMatches.length);

  if (totalMatches > MAX_RENDER) {
    elements.renderNote.textContent = `Showing first ${formatNumber(MAX_RENDER)} of ${formatNumber(totalMatches)} matches. Type more letters to narrow.`;
  } else {
    elements.renderNote.textContent = `${formatNumber(totalMatches)} match${totalMatches === 1 ? "" : "es"} for ${state.prefix.toUpperCase()}.`;
  }

  renderWords(shownMatches);
}

function findMatches(prefix) {
  const lowerPrefix = prefix.toLowerCase();
  let source = state.words;

  if (lowerPrefix.length >= 2) {
    source = state.byFirstTwo.get(lowerPrefix.slice(0, 2)) || [];
  } else if (lowerPrefix.length === 1) {
    source = state.byFirst.get(lowerPrefix) || [];
  }

  if (lowerPrefix.length === 1) {
    return source;
  }

  const filtered = [];
  for (let i = 0; i < source.length; i += 1) {
    const word = source[i];
    if (word.startsWith(lowerPrefix)) {
      filtered.push(word);
    }
  }
  return filtered;
}

function renderWords(words) {
  if (words.length === 0) {
    elements.results.innerHTML = '<span class="word-item">No matches.</span>';
    return;
  }

  const html = words.map((word) => `<span class="word-item">${word}</span>`).join("");
  elements.results.innerHTML = html;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}