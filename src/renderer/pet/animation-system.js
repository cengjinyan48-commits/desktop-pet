// Animation System — State machine for all pet animations
// States: idle | walk | sleep | happy | stretch | yawn | eat | pet | rabbit | rabbit-walk | rabbit-happy

// SpriteGenerator 由 sprite-generator.js 以 <script> 先行加载（window.SpriteGenerator）

const FRAME_COUNT = { idle:4, walk:6, sleep:4, happy:4, stretch:4, yawn:4, eat:4, pet:2, rabbit:4, 'rabbit-walk':6, 'rabbit-happy':4 };
const FRAME_MS    = { idle:500, walk:150, sleep:800, happy:120, stretch:200, yawn:250, eat:200, pet:300, rabbit:500, 'rabbit-walk':150, 'rabbit-happy':120 };

function _baseState(state) {
  if (!state) return 'idle';
  if (state.startsWith('rabbit')) return 'rabbit';
  return state;
}

const AnimationSystem = {
  _state: 'idle',
  _prevState: 'idle',
  _frameIndex: 0,
  _accumulator: 0,
  _sprites: {},
  _lastTimestamp: 0,
  _idleTimer: 0,
  _randomActionTimer: 0,
  _randomActionInterval: 30000,
  _onStateChange: null,
  _loopCount: 0,
  _mood: 50,
  _skin: 'orange',

  // ── Init ────────────────────────────────────────
  init() {
    const states = ['idle','walk','sleep','happy','stretch','yawn','eat','pet','rabbit','rabbit-walk','rabbit-happy'];
    for (const s of states) this._sprites[s] = SpriteGenerator.generateAllFrames(s);
    this._skin = SpriteGenerator.getCurrentSkin ? SpriteGenerator.getCurrentSkin() : 'orange';
    this._state = this._skin === 'rabbit' ? 'rabbit' : 'idle';
    this._frameIndex = 0;
    this._accumulator = 0;
    this._idleTimer = 0;
    this._randomActionTimer = 0;
    this._loopCount = 0;
    this._lastTimestamp = performance.now();
    this._pickRandomActionInterval();
  },

  // ── State ────────────────────────────────────────
  getState() { return this._state; },
  getPrevState() { return this._prevState; },
  getMood() { return this._mood; },
  setMood(v) { this._mood = Math.max(0, Math.min(100, v)); },
  changeMood(delta) { this.setMood(this._mood + delta); },
  getMoodLabel() {
    if (this._mood >= 80) return 'ecstatic';
    if (this._mood >= 60) return 'happy';
    if (this._mood >= 40) return 'neutral';
    if (this._mood >= 20) return 'grumpy';
    return 'depressed';
  },

  getCurrentFrame() {
    return this._sprites[this._state]?.[this._frameIndex] || null;
  },

  // ── Mood-dependent eye type ──────────────────────
  _moodEyeType() {
    if (this._mood >= 60) return 'happy';
    if (this._mood >= 20) return 'smug';
    return 'sideeye'; // extra judging when grumpy
  },

  // ── Transitions ──────────────────────────────────
  _setStateInternal(newState) {
    if (newState === this._state) return;
    this._prevState = this._state;
    this._state = newState;
    this._frameIndex = 0;
    this._accumulator = 0;
    this._loopCount = 0;
    if (this._onStateChange) this._onStateChange(newState, this._prevState);
  },

  onStateChange(cb) { this._onStateChange = cb; },

  // ── Skin-aware state helper ──────────────────────
  _s(base) {
    if (this._skin === 'rabbit') {
      if (base === 'idle')  return 'rabbit';
      if (base === 'walk')  return 'rabbit-walk';
      if (base === 'happy') return 'rabbit-happy';
      if (base === 'sleep') return 'rabbit'; // rabbit doesn't have sleep anim
      return 'rabbit-' + base; // fallback with prefix
    }
    return base;
  },

  // ── Triggers ─────────────────────────────────────
  onDragStart() { this._setStateInternal(this._s('walk')); },
  onDragEnd() {
    const cur = this._state;
    if (cur === 'walk' || cur === 'rabbit-walk') this._setStateInternal(this._s('idle'));
  },
  onCursorEnter() { this._idleTimer = 0; if (this._state === 'sleep') this._setStateInternal(this._s('idle')); },
  onTaskCompleted() { this.changeMood(15); this._setStateInternal(this._s('happy')); },
  onHeadPet()    { this.changeMood(5); this._setStateInternal(this._s('happy')); },
  onFeed()       { this.changeMood(20); this._setStateInternal(this._s('happy')); },
  onInteraction() { this._idleTimer = 0; },

  // ── Update ───────────────────────────────────────
  update(deltaMs) {
    // Idle timer for sleep
    if (this._state === 'idle') {
      this._idleTimer += deltaMs;
      if (this._idleTimer > 30 * 60 * 1000) {
        this._setStateInternal('sleep');
        return;
      }
    }

    // Random idle actions
    if (this._state === 'idle') {
      this._randomActionTimer += deltaMs;
      if (this._randomActionTimer >= this._randomActionInterval) {
        this._randomActionTimer = 0;
        this._pickRandomActionInterval();
        this._doRandomAction();
      }
    }

    // Frame advancement
    const msPerFrame = FRAME_MS[this._state] || 500;
    const totalFrames = FRAME_COUNT[this._state] || 4;
    this._accumulator += deltaMs;

    let frameChanged = false;
    while (this._accumulator >= msPerFrame) {
      this._accumulator -= msPerFrame;
      this._frameIndex++;
      frameChanged = true;

      if (this._frameIndex >= totalFrames) {
        this._frameIndex = 0;
        this._loopCount++;

        // One-shot animations return to idle
        if (['happy','stretch','yawn','eat','pet'].includes(this._state)) {
          if (this._state === 'eat') this._loopCount = 0; // eat plays twice
          if (this._loopCount >= (this._state === 'eat' ? 2 : 1)) {
            this._setStateInternal('idle');
            break;
          }
        }
      }
    }
    return frameChanged;
  },

  // ── Random Actions ───────────────────────────────
  _pickRandomActionInterval() {
    // 30-120 seconds between random actions
    this._randomActionInterval = 30000 + Math.random() * 90000;
  },

  _doRandomAction() {
    const actions = ['stretch', 'yawn', 'stretch', 'yawn', 'idle'];
    const pick = actions[Math.floor(Math.random() * actions.length)];
    if (pick === 'idle') return; // just skip this round
    this._setStateInternal(pick);
  },

  resetIdleTimer() { this._idleTimer = 0; },
  getSleepProgress() { return Math.min(1, this._idleTimer / (30*60*1000)); }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimationSystem;
}
