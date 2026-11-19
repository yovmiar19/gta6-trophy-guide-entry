// Leonida Ledger: an offline GTA VI trophy guide and tracker.
// Loads its own data file, renders the checklist, and keeps progress in
// localStorage. Nothing leaves the browser except the export file the
// reader asks for.
const STORAGE_KEY = 'gta6-trophy-guide-progress-v1';
const DATA_URL = 'data/trophies.json';

const listEl = document.getElementById('trophyList');
const metaEl = document.getElementById('listMeta');
const emptyEl = document.getElementById('emptyState');
const earnedCountEl = document.getElementById('earnedCount');
const gradeCountsEl = document.getElementById('gradeCounts');
const progressFillEl = document.getElementById('progressFill');
const kindFiltersEl = document.getElementById('kindFilters');
const searchEl = document.getElementById('search');
const earnedOnlyEl = document.getElementById('earnedOnly');
const spoilerEl = document.getElementById('spoilerToggle');
const exportBtn = document.getElementById('exportBtn');
const importFileEl = document.getElementById('importFile');
const resetBtn = document.getElementById('resetBtn');

const KIND_LABELS = [
  ['all', 'All'],
  ['story', 'Story'],
  ['missable', 'Missable'],
  ['collectibles', 'Collectibles'],
  ['activities', 'Activities'],
  ['platinum', 'Platinum'],
  ['online', 'Online'],
];

const state = {
  trophies: [],
  earned: loadEarned(),
  open: new Set(),
  kind: 'all',
  query: '',
  earnedOnly: false,
  hideSpoilers: true,
};

function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((id) => Number.isInteger(id) && id >= 1 && id <= 55));
  } catch {
    return new Set();
  }
}

function saveEarned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b)));
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function isHidden(trophy) {
  return state.hideSpoilers && trophy.kind.includes('story') && !state.earned.has(trophy.id);
}

function visibleTrophies() {
  const query = state.query.trim().toLowerCase();
  return state.trophies.filter((trophy) => {
    if (state.kind === 'online') return false;
    if (state.kind !== 'all' && !trophy.kind.includes(state.kind)) return false;
    if (state.earnedOnly && !state.earned.has(trophy.id)) return false;
    if (query) {
      const hay = (trophy.name + ' ' + trophy.description).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function renderKindButtons() {
  kindFiltersEl.textContent = '';
  for (const [kind, label] of KIND_LABELS) {
    const count = kind === 'all'
      ? state.trophies.length
      : kind === 'online'
        ? 0
        : state.trophies.filter((t) => t.kind.includes(kind)).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label + ' (' + count + ')';
    button.setAttribute('aria-pressed', state.kind === kind ? 'true' : 'false');
    button.classList.toggle('active', state.kind === kind);
    button.addEventListener('click', () => {
      state.kind = kind;
      renderKindButtons();
      renderList();
    });
    kindFiltersEl.appendChild(button);
  }
}

function renderProgress() {
  const earned = state.earned.size;
  const total = state.trophies.length || 55;
  earnedCountEl.textContent = earned + ' of ' + total + ' earned';
  const grades = ['platinum', 'gold', 'silver', 'bronze'];
  const parts = grades.map((grade) => {
    const have = state.trophies.filter((t) => t.grade === grade && state.earned.has(t.id)).length;
    const all = state.trophies.filter((t) => t.grade === grade).length;
    return gradeLabel(grade) + ' ' + have + '/' + all;
  });
  gradeCountsEl.textContent = ' (' + parts.join(', ') + ')';
  progressFillEl.style.transform = 'scaleX(' + (total ? earned / total : 0) + ')';
  for (const stage of [1, 2, 3]) {
    const el = document.getElementById('stageCount' + stage);
    if (!el) continue;
    const inStage = state.trophies.filter((t) => t.stage === stage);
    const done = inStage.filter((t) => state.earned.has(t.id)).length;
    el.textContent = done + ' of ' + inStage.length + ' earned';
  }
}

function sourceLink(source) {
  if (source.url) {
    const link = document.createElement('a');
    link.href = source.url;
    link.textContent = source.name;
    link.target = '_blank';
    link.rel = 'noopener';
    return link;
  }
  const span = document.createElement('span');
  span.textContent = source.name;
  return span;
}

function buildDetail(trophy) {
  const detail = document.createElement('div');
  detail.className = 'detail';
  detail.hidden = !state.open.has(trophy.id);
  const guideTitle = document.createElement('p');
  const guideLabel = document.createElement('span');
  guideLabel.className = 'guide-label';
  guideLabel.textContent = 'How to earn it: ';
  guideTitle.append(guideLabel, document.createTextNode(trophy.guide));
  if (trophy.guide.startsWith('No confirmed unlock yet.')) {
    guideTitle.classList.add('unknown');
  }
  detail.appendChild(guideTitle);
  const stageLine = document.createElement('p');
  const stageNames = { 1: 'Stage 1: Play the story', 2: 'Stage 2: The 100% checklist', 3: 'Stage 3: Cleanup' };
  stageLine.textContent = 'Roadmap: ' + (stageNames[trophy.stage] || 'Stage ' + trophy.stage) + '.';
  if (trophy.missable) {
    const warn = document.createElement('strong');
    warn.textContent = ' Can be missed: read the guide before the chapter ends.';
    stageLine.appendChild(warn);
  }
  detail.appendChild(stageLine);
  const sourceTitle = document.createElement('p');
  sourceTitle.textContent = 'Sources:';
  detail.appendChild(sourceTitle);
  const sourceList = document.createElement('ul');
  sourceList.className = 'source-list';
  for (const source of trophy.sources) {
    const item = document.createElement('li');
    item.appendChild(sourceLink(source));
    sourceList.appendChild(item);
  }
  detail.appendChild(sourceList);
  return detail;
}

function buildRow(trophy) {
  const item = document.createElement('li');
  const hidden = isHidden(trophy);
  const earned = state.earned.has(trophy.id);
  const row = document.createElement('div');
  row.className = 'trophy-row' + (earned ? ' earned' : '');
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = earned;
  check.setAttribute('aria-label', 'Mark ' + trophy.name + ' as earned');
  check.addEventListener('change', () => {
    if (check.checked) state.earned.add(trophy.id);
    else state.earned.delete(trophy.id);
    saveEarned();
    renderProgress();
    row.classList.toggle('earned', check.checked);
    if (hidden) renderList();
  });
  row.appendChild(check);
  const main = document.createElement('div');
  main.className = 'trophy-main';
  const name = document.createElement('div');
  name.className = 'trophy-name';
  name.textContent = hidden ? 'Hidden story trophy' : trophy.name;
  if (trophy.missable) {
    const tag = document.createElement('span');
    tag.className = 'missable-tag';
    tag.textContent = 'Missable';
    name.appendChild(tag);
  }
  main.appendChild(name);
  const desc = document.createElement('p');
  desc.className = 'trophy-desc';
  desc.textContent = hidden ? 'Earn it in the game to reveal this trophy.' : trophy.description;
  main.appendChild(desc);
  const kinds = document.createElement('div');
  kinds.className = 'trophy-kinds';
  for (const kind of trophy.kind) {
    const tag = document.createElement('span');
    tag.className = 'kind-tag';
    tag.textContent = kind;
    kinds.appendChild(tag);
  }
  main.appendChild(kinds);
  row.appendChild(main);
  const chip = document.createElement('span');
  chip.className = 'grade-chip grade-' + trophy.grade;
  chip.textContent = gradeLabel(trophy.grade);
  row.appendChild(chip);
  item.appendChild(row);
  if (!hidden) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'detail-toggle';
    toggle.setAttribute('aria-expanded', state.open.has(trophy.id) ? 'true' : 'false');
    toggle.textContent = state.open.has(trophy.id) ? 'Hide guide' : 'Show guide';
    const detail = buildDetail(trophy);
    toggle.addEventListener('click', () => {
      if (state.open.has(trophy.id)) state.open.delete(trophy.id);
      else state.open.add(trophy.id);
      detail.hidden = !state.open.has(trophy.id);
      toggle.setAttribute('aria-expanded', state.open.has(trophy.id) ? 'true' : 'false');
      toggle.textContent = state.open.has(trophy.id) ? 'Hide guide' : 'Show guide';
    });
    item.appendChild(toggle);
    item.appendChild(detail);
  }
  return item;
}

function renderList() {
  const shown = visibleTrophies();
  listEl.textContent = '';
  for (const trophy of shown) {
    listEl.appendChild(buildRow(trophy));
  }
  emptyEl.hidden = shown.length !== 0;
  const kindName = state.kind === 'all' ? '' : ' in ' + state.kind;
  metaEl.textContent = 'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies' + kindName + '.';
  renderProgress();
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportBtn.addEventListener('click', () => {
  download('gta6-trophy-progress.json', JSON.stringify({
    game: 'Grand Theft Auto VI',
    earned: [...state.earned].sort((a, b) => a - b),
    exportedAt: new Date().toISOString(),
  }, null, 2));
});

importFileEl.addEventListener('change', () => {
  const file = importFileEl.files && importFileEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const ids = Array.isArray(data) ? data : data.earned;
      if (!Array.isArray(ids)) throw new Error('bad file');
      const valid = ids.filter((id) => Number.isInteger(id) && id >= 1 && id <= 55);
      state.earned = new Set(valid);
      saveEarned();
      renderList();
    } catch {
      window.alert('That file is not a progress export from this guide.');
    }
    importFileEl.value = '';
  };
  reader.readAsText(file);
});

resetBtn.addEventListener('click', () => {
  if (!window.confirm('Clear every tick on this checklist?')) return;
  state.earned = new Set();
  state.open = new Set();
  saveEarned();
  renderList();
});

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  renderList();
});

earnedOnlyEl.addEventListener('change', () => {
  state.earnedOnly = earnedOnlyEl.checked;
  renderList();
});

spoilerEl.addEventListener('change', () => {
  state.hideSpoilers = spoilerEl.checked;
  renderList();
});

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error('could not load trophies');
    return response.json();
  })
  .then((data) => {
    state.trophies = data.trophies;
    renderKindButtons();
    renderList();
  })
  .catch(() => {
    metaEl.textContent = 'The trophy list could not be loaded. Check that data/trophies.json sits beside this page.';
  });
