let navigateHandler = null;

function registerNavigate(fn) {
  navigateHandler = fn;
}

function navigateTo(viewName, params) {
  if (navigateHandler) navigateHandler(viewName, params);
}

export { registerNavigate, navigateTo };
