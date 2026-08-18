import type { Preset } from "./types.js";

/**
 * Ready-made sessions. A preset is a hand-picked running order rather than a
 * filter and the order is the point: something to do on arrival, then movement
 * prep, then the skill, then a game where they have to use it.
 *
 * Every one is checked by src/__tests__/content-age-gate.test.ts, which will not
 * let a preset hold a drill its own age grade is not allowed to do.
 */
export const PRESETS: Preset[] = [
  // ---- Tag grades ----
  {
    id: "preset-u7-first-session",
    title: "First session of the season",
    ageGroup: "u7",
    theme: "handling",
    sessionMinutes: 45,
    drillIds: [
      "warmup-name-and-pass",
      "warmup-tail-snatch",
      "drill-two-hand-relay",
      "drill-gate-choice",
      "drill-end-ball",
    ],
  },
  {
    id: "preset-u7-hands-and-space",
    title: "Hands and space",
    ageGroup: "u7",
    theme: "handling",
    sessionMinutes: 45,
    drillIds: [
      "warmup-two-ball-square",
      "warmup-rob-the-nest",
      "drill-pass-down-the-line",
      "drill-corner-ball",
    ],
  },
  {
    id: "preset-u8-beating-a-defender",
    title: "Beating a defender",
    ageGroup: "u8",
    theme: "evasion",
    sessionMinutes: 45,
    drillIds: [
      "warmup-tail-snatch",
      "warmup-shark-in-the-pond",
      "drill-side-step-slalom",
      "drill-tag-and-turn",
      "drill-two-ball-chaos",
    ],
  },
  {
    id: "preset-u8-heads-up-rugby",
    title: "Heads up rugby",
    ageGroup: "u8",
    theme: "gamesense",
    sessionMinutes: 60,
    drillIds: [
      "warmup-numbers-scramble",
      "warmup-four-corner-passing",
      "drill-hit-the-hole",
      "drill-ten-metre-decisions",
      "drill-defend-the-line",
      "drill-four-goals",
    ],
  },

  // ---- First contact ----
  {
    id: "preset-u9-first-tackles",
    title: "First tackles",
    ageGroup: "u9",
    theme: "tackle",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-down-and-up",
      "warmup-shoulder-to-shield",
      "drill-cheek-to-cheek",
      "drill-side-on-tackle",
    ],
  },
  {
    id: "preset-u9-looking-after-the-ball",
    title: "Looking after the ball",
    ageGroup: "u9",
    theme: "handling",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-jog-and-place",
      "drill-long-placement",
      "drill-under-pressure-hands",
      "drill-support-the-break",
    ],
  },

  // ---- Ruck, maul and set piece ----
  {
    id: "preset-u10-rucking",
    title: "Rucking",
    ageGroup: "u10",
    theme: "breakdown",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-body-position-ladder",
      "drill-step-over-and-stay",
      "drill-two-second-ruck",
      "drill-five-second-count",
    ],
  },
  {
    id: "preset-u10-restarts",
    title: "Scrums and restarts",
    ageGroup: "u10",
    theme: "setpiece",
    sessionMinutes: 45,
    drillIds: [
      "warmup-scrum-shape-hold",
      "warmup-two-ball-square",
      "drill-three-player-scrum-shape",
      "drill-scrum-half-feed",
    ],
  },
  {
    id: "preset-u10-tackle-and-after",
    title: "The tackle and what comes next",
    ageGroup: "u10",
    theme: "tackle",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-wrestle-for-the-ball",
      "drill-front-on-tackle",
      "drill-tackle-then-compete",
    ],
  },
  {
    id: "preset-u11-quick-ball",
    title: "Quick ball",
    ageGroup: "u11",
    theme: "breakdown",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-grip-and-drive",
      "drill-counter-ruck",
      "drill-maul-three-and-move",
      "drill-ruck-to-ruck",
    ],
  },
  {
    id: "preset-u11-using-the-width",
    title: "Using the width",
    ageGroup: "u11",
    theme: "evasion",
    sessionMinutes: 60,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-three-corner-sprint",
      "drill-spin-pass-build",
      "drill-beat-the-drift",
      "drill-scoring-zones",
    ],
  },
  {
    id: "preset-u12-set-piece-day",
    title: "Set piece day",
    ageGroup: "u12",
    theme: "setpiece",
    sessionMinutes: 75,
    drillIds: [
      "warmup-scrum-shape-hold",
      "warmup-lineout-lift-shape",
      "drill-five-player-scrum",
      "drill-lineout-throw-accuracy",
      "drill-lineout-uncontested",
      "drill-lineout-to-attack",
    ],
  },
  {
    id: "preset-u12-match-week",
    title: "Match week",
    ageGroup: "u12",
    theme: "gamesense",
    sessionMinutes: 75,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-tackle-tube-roll",
      "drill-turnover-to-try",
      "drill-space-then-contact",
      "drill-full-game-conditions",
    ],
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** Presets a coach at this age grade can actually run. */
export function presetsForAge(ageGroup: string): Preset[] {
  return PRESETS.filter((preset) => preset.ageGroup === ageGroup);
}
