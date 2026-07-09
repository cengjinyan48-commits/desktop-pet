// Desktop Pet — Configuration Constants

module.exports = {
  // Window sizes
  PET_WINDOW_WIDTH: 280,
  PET_WINDOW_HEIGHT: 280,
  TASK_PANEL_WIDTH: 340,
  TASK_PANEL_HEIGHT: 520,

  // Pixel art sprite
  SPRITE_FRAME_SIZE: 32,      // native pixel size of a single frame
  SPRITE_SCALE: 4,            // canvas upscale factor (32→128px on screen)
  SPRITE_FRAME_COUNT: {
    idle: 4,
    walk: 6,
    sleep: 4,
    happy: 4
  },

  // Animation speeds (ms per frame)
  ANIMATION_MS: {
    idle: 500,
    walk: 150,
    sleep: 800,
    happy: 120
  },

  // Interaction
  CURSOR_POLL_INTERVAL: 200,        // ms — how often we check cursor position
  CURSOR_PROXIMITY_MARGIN: 20,      // px — expand pet bounds by this much
  CURSOR_EXIT_HYSTERESIS: 30,       // px — extra margin before restoring click-through
  INTERACTION_IDLE_TIMEOUT: 30000,  // ms — auto-re-lock after this long with no click
  SLEEP_TRIGGER_IDLE: 30 * 60 * 1000, // ms — no cursor proximity before sleep kicks in

  // Morning check-in
  CHECKIN_HOUR: 9,
  CHECKIN_MINUTE: 0,
  CHECKIN_TZ: 'Asia/Shanghai',

  // Calendar
  DEFAULT_CALENDAR: '个人',

  // Time period defaults (when pushing to Calendar)
  TIME_PERIOD_DEFAULTS: {
    morning:   { label: '上午', startHour: 9 },
    afternoon: { label: '下午', startHour: 14 },
    evening:   { label: '晚上', startHour: 19 }
  },

  // Task parser
  TIME_PERIOD_MAP: {
    morning:   /上午|早上|早晨|am|AM/,
    afternoon: /中午|下午|pm|PM/,
    evening:   /晚上|傍晚|夜间|今晚/
  },

  // App
  APP_NAME: 'Desktop Pet',
  PET_DEFAULT_NAME: '鱼烧'
};
