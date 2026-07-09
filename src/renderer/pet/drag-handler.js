// Drag Handler — Manual window dragging via IPC
//
// Since the pet window uses click-through by default,
// drag only works when the window is interactive
// (cursor is near the pet, or interaction is locked).

const DragHandler = {
  _canvas: null,
  _isDragging: false,
  _startX: 0,
  _startY: 0,
  _onDragStart: null,
  _onDragEnd: null,

  init(canvas) {
    this._canvas = canvas;

    canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));
  },

  _onMouseDown(e) {
    // Only start drag on left click when interactive
    if (e.button !== 0) return;

    this._isDragging = true;
    this._startX = e.screenX;
    this._startY = e.screenY;

    if (this._onDragStart) this._onDragStart();

    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.startDrag({ x: e.screenX, y: e.screenY });
    }
  },

  _onMouseMove(e) {
    if (!this._isDragging) return;

    const deltaX = e.screenX - this._startX;
    const deltaY = e.screenY - this._startY;

    // Only move if there's significant delta (avoid tiny jitter)
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    if (window.electronAPI) {
      window.electronAPI.moveWindow({ dx: deltaX, dy: deltaY });
    }

    this._startX = e.screenX;
    this._startY = e.screenY;
  },

  _onMouseUp() {
    if (!this._isDragging) return;
    this._isDragging = false;

    if (this._onDragEnd) this._onDragEnd();

    if (window.electronAPI) {
      window.electronAPI.endDrag();
    }
  },

  isDragging() {
    return this._isDragging;
  },

  onDragStart(callback) {
    this._onDragStart = callback;
  },

  onDragEnd(callback) {
    this._onDragEnd = callback;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DragHandler;
}
