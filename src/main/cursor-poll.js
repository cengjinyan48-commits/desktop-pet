// Cursor Poll — Proximity-based click-through toggle
//
// Polls the global cursor position every N ms.
// When the cursor is near the pet window, disables click-through
// so the user can interact (drag, click speech bubble, etc.).
// When the cursor moves away, re-enables click-through.

const { screen } = require('electron');
const windows = require('./window-manager');
const config = require('./config');

let intervalId = null;
let isInteractive = false;
let interactionLocked = false;
let isDragging = false;

// ── Public API ──────────────────────────────────────────

function start() {
  if (intervalId) return;

  intervalId = setInterval(checkCursor, config.CURSOR_POLL_INTERVAL);
  console.log('🖱️  Cursor poll started (every', config.CURSOR_POLL_INTERVAL, 'ms)');
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function lockInteraction() {
  interactionLocked = true;
  if (!isInteractive) {
    _setInteractive(true);
  }
}

function unlockInteraction() {
  interactionLocked = false;
  // Don't immediately restore — let next poll cycle decide
}

function setDragging(val) {
  isDragging = val;
  if (val && !isInteractive) {
    _setInteractive(true);
  }
}

// ── Internal ────────────────────────────────────────────

function checkCursor() {
  const bounds = windows.getPetBounds();
  if (!bounds) return;

  const cursor = screen.getCursorScreenPoint();

  // Expand bounds by proximity margin for "hover near" detection
  const margin = config.CURSOR_PROXIMITY_MARGIN;
  const expanded = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2
  };

  const cursorInside =
    cursor.x >= expanded.x &&
    cursor.x <= expanded.x + expanded.width &&
    cursor.y >= expanded.y &&
    cursor.y <= expanded.y + expanded.height;

  if (cursorInside) {
    if (!isInteractive) {
      _setInteractive(true);
    }
  } else {
    // Exit hysteresis: cursor must be further away before restoring
    const hysteresis = config.CURSOR_EXIT_HYSTERESIS;
    const hystBounds = {
      x: bounds.x - hysteresis,
      y: bounds.y - hysteresis,
      width: bounds.width + hysteresis * 2,
      height: bounds.height + hysteresis * 2
    };
    const cursorFarEnough =
      cursor.x < hystBounds.x ||
      cursor.x > hystBounds.x + hystBounds.width ||
      cursor.y < hystBounds.y ||
      cursor.y > hystBounds.y + hystBounds.height;

    if (cursorFarEnough && isInteractive && !interactionLocked && !isDragging) {
      _setInteractive(false);
    }
  }
}

function _setInteractive(interactive) {
  isInteractive = interactive;
  windows.setPetIgnoreMouse(!interactive);

  // Notify renderer
  const pw = windows.getPetWindow();
  if (pw && !pw.isDestroyed()) {
    pw.webContents.send(interactive ? 'cursor:enter' : 'cursor:leave');
  }
}

module.exports = { start, stop, lockInteraction, unlockInteraction, setDragging };
