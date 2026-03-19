const MAX_RENDER = 25000;
const RENDER_CHUNK_SIZE = 450;
const SORT_MODES = {
  ALPHA_ASC: "alpha-asc",
  ALPHA_DESC: "alpha-desc",
  LENGTH_ASC: "length-asc",
  LENGTH_DESC: "length-desc"
};

const elements = {
  dictionarySize: document.getElementById("dictionarySize"),
  prefixInput: document.getElementById("prefixInput"),
  clearBtn: document.getElementById("clearBtn"),
  focusBtn: document.getElementById("focusBtn"),
  sortSelect: document.getElementById("sortSelect"),
  matchCount: document.getElementById("matchCount"),
  renderCount: document.getElementById("renderCount"),
  statusTag: document.getElementById("statusTag"),
  renderNote: document.getElementById("renderNote"),
  results: document.getElementById("results")
};

const state = {
  words: [],
  wordsByLength: [],
  availableLengths: [],
  availableLengthsDesc: [],
  prefix: "",
  sortMode: SORT_MODES.ALPHA_ASC,
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
  elements.sortSelect.addEventListener("change", onSortChange);

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

function onSortChange(event) {
  const nextMode = event.target.value;

  if (!Object.values(SORT_MODES).includes(nextMode)) {
    event.target.value = state.sortMode;
    return;
  }

  if (nextMode !== state.sortMode) {
    state.sortMode = nextMode;
    updateView();
  }
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

  for (let i = 0; i < state.words.length; i += 1) {
    const word = state.words[i];
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
    elements.renderNote.textContent = `Type letters to filter. Example: C, then A, then T. Sort: ${getSortLabel(state.sortMode)}.`;
    elements.results.innerHTML = "";
    return;
  }

  const range = findPrefixRange(state.prefix);
  const totalMatches = range.end - range.start;
  const shownMatches = Math.min(totalMatches, MAX_RENDER);
  const wordsToRender = collectVisibleMatches(state.prefix, range, shownMatches);

  elements.matchCount.textContent = formatNumber(totalMatches);
  elements.renderCount.textContent = formatNumber(shownMatches);

  if (totalMatches > MAX_RENDER) {
    elements.renderNote.textContent = `Showing first ${formatNumber(MAX_RENDER)} of ${formatNumber(totalMatches)} matches (${getSortLabel(state.sortMode)}). Type more letters to narrow.`;
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
  const suffix = `${prefix}{`;
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

    const start = lowerBound(bucket, prefix);
    const end = lowerBound(bucket, suffix);
    const matchesInBucket = end - start;

    if (matchesInBucket <= 0) {
      continue;
    }

    const take = Math.min(count - words.length, matchesInBucket);
    for (let j = 0; j < take; j += 1) {
      words.push(bucket[start + j]);
    }
  }

  return words;
}

function renderWordList(words, renderJobId) {
  if (words.length === 0) {
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
    const stop = Math.min(cursor + RENDER_CHUNK_SIZE, words.length);

    for (let i = cursor; i < stop; i += 1) {
      const word = words[i];
      const item = document.createElement("span");
      item.className = "word-item";
      item.textContent = word;
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
