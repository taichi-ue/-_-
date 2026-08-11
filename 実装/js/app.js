import { openDB, getAll } from './db.js';
import { registerNavigate } from './router.js';
import * as importView from './importView.js';
import * as assignView from './assignView.js';
import * as historyView from './historyView.js';
import * as reportView from './reportView.js';
import * as settingsView from './settingsView.js';

const viewRoot = document.getElementById('view-root');
const navButtons = document.querySelectorAll('.nav-btn');

const views = {
  import: importView,
  assign: assignView,
  history: historyView,
  report: reportView,
  settings: settingsView,
};

function setActiveNav(viewName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
}

let currentView = null;

function showView(viewName, params) {
  const view = views[viewName];
  if (!view) return;

  if (currentView && typeof currentView.destroy === 'function') {
    currentView.destroy();
  }

  setActiveNav(viewName);
  view.render(viewRoot, params);
  currentView = view;
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

registerNavigate(showView);

async function init() {
  try {
    await openDB();
    console.log('IndexedDB initialized: kurekaSplitDB');

    const transactions = await getAll('transactions');
    const initialView = transactions.length === 0 ? 'import' : 'assign';
    showView(initialView);
  } catch (err) {
    console.error('Failed to open IndexedDB', err);
    viewRoot.innerHTML = '<p>データベースの初期化に失敗しました。</p>';
  }
}

init();
