const viewRoot = document.getElementById('view-root');
const navButtons = document.querySelectorAll('.nav-btn');

const VIEW_LABELS = {
  import: '取込',
  assign: '振り分け',
  history: '履歴',
  report: '集計',
  settings: '設定',
};

function renderPlaceholder(viewName) {
  viewRoot.innerHTML = `<p>${VIEW_LABELS[viewName]} 画面（準備中）</p>`;
}

function setActiveNav(viewName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
}

function showView(viewName) {
  setActiveNav(viewName);
  renderPlaceholder(viewName);
}

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

showView('import');
