function bindArrowKeys({ onLeft, onRight, onDown }) {
  function handler(event) {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (event.key === 'ArrowLeft' && onLeft) {
      event.preventDefault();
      onLeft();
    } else if (event.key === 'ArrowRight' && onRight) {
      event.preventDefault();
      onRight();
    } else if (event.key === 'ArrowDown' && onDown) {
      event.preventDefault();
      onDown();
    }
  }

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}

export { bindArrowKeys };
