import type { Preset } from "./types.js";

/**
 * Ready-made sessions. A preset is a hand-picked running order rather than a
 * filter and the order is the point: something to do on arrival, then movement
 * prep, then the skill, then a game where they have to use it.
 *
 * Four rules. The tests hold all four:
 *
 * - It opens with a warm-up.
 * - It ends with a game. A session that finishes on a drill finishes on the coach
 *   talking. The drill was only ever there so they could use it in a game.
 * - It fills the time it claims. `fromPreset` drops a water break in the middle,
 *   so the drills come to roughly the session length minus that break. A preset
 *   that opened saying "22 minutes still to fill" was worse than no preset.
 * - Every drill in it is legal at that age grade.
 *
 * `src/__tests__/content-age-gate.test.ts` checks the age gate and the shape,
 * `src/__tests__/sessionPlan.test.ts` builds every one of these into a plan and
 * fails if it raises a single warning.
 */
export const PRESETS: Preset[] = [
  // ---- U7. Tag. Games for most of it ----
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
      "drill-keep-ball-count",
    ],
  },
  {
    id: "preset-u7-tag-and-run",
    title: "Tag and run",
    ageGroup: "u7",
    theme: "evasion",
    sessionMinutes: 45,
    drillIds: [
      "warmup-traffic-lights",
      "warmup-shark-in-the-pond",
      "drill-side-step-slalom",
      "drill-tag-and-turn",
      "drill-four-goals",
    ],
  },
  {
    id: "preset-u7-games-night",
    title: "Games night",
    ageGroup: "u7",
    theme: "gamesense",
    sessionMinutes: 45,
    drillIds: [
      "warmup-follow-the-leader",
      "warmup-rob-the-nest",
      "drill-british-bulldog-ball",
      "drill-catch-and-turn",
      "drill-keep-ball-count",
    ],
  },

  // ---- U8. Still tag, starting to look up ----
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
    id: "preset-u8-catch-and-pass",
    title: "Catch it and pass it",
    ageGroup: "u8",
    theme: "handling",
    sessionMinutes: 45,
    drillIds: [
      "warmup-four-corner-passing",
      "warmup-numbers-scramble",
      "drill-pop-pass-gates",
      "drill-loop-and-go",
      "drill-numbers-up",
    ],
  },
  {
    id: "preset-u8-before-the-first-game",
    title: "Week before the first game",
    ageGroup: "u8",
    theme: "gamesense",
    sessionMinutes: 45,
    drillIds: [
      "warmup-numbers-scramble",
      "warmup-tail-snatch",
      "drill-out-the-back-door",
      "drill-defend-the-line",
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

  // ---- U9. Tackling starts here, everything else carries on ----
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
      "drill-no-talking-game",
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
      "drill-scoring-zones",
    ],
  },
  {
    id: "preset-u9-finding-space",
    title: "Finding the space",
    ageGroup: "u9",
    theme: "evasion",
    sessionMinutes: 60,
    drillIds: [
      "warmup-three-corner-sprint",
      "warmup-partner-mirror",
      "drill-switch-pass",
      "drill-hit-the-hole",
      "drill-narrow-to-wide",
      "drill-support-the-break",
    ],
  },
  {
    id: "preset-u9-playing-what-you-see",
    title: "Playing what you see",
    ageGroup: "u9",
    theme: "gamesense",
    sessionMinutes: 60,
    drillIds: [
      "warmup-numbers-scramble",
      "warmup-hospital-pass",
      "drill-tackle-and-get-up",
      "drill-under-pressure-hands",
      "drill-ten-metre-decisions",
      "drill-turnover-game",
    ],
  },

  // ---- U10. Ruck, maul and the three player scrum arrive ----
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
      "drill-three-phase-game",
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
      "drill-scrum-and-away",
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
      "drill-defend-your-channel",
    ],
  },
  {
    id: "preset-u10-quick-hands",
    title: "Quick hands",
    ageGroup: "u10",
    theme: "handling",
    sessionMinutes: 60,
    drillIds: [
      "warmup-two-ball-square",
      "warmup-hospital-pass",
      "drill-square-and-pass",
      "drill-blind-pass-drill",
      "drill-offload-in-the-tackle",
      "drill-two-touch-attack",
    ],
  },
  {
    id: "preset-u10-first-defender",
    title: "Beating the first defender",
    ageGroup: "u10",
    theme: "evasion",
    sessionMinutes: 60,
    drillIds: [
      "warmup-three-corner-sprint",
      "warmup-ankles-and-knees",
      "drill-shadow-and-step",
      "drill-one-on-one-channel",
      "drill-narrow-to-wide",
      "drill-outnumbered-defence",
    ],
  },
  {
    id: "preset-u10-match-week",
    title: "Match week",
    ageGroup: "u10",
    theme: "gamesense",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-numbers-scramble",
      "drill-scrum-and-away",
      "drill-outnumbered-defence",
      "drill-scoring-zones",
      "drill-three-phase-game",
    ],
  },

  // ---- U11. Nine a side, kicking allowed, the game speeds up ----
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
      "drill-narrow-to-wide",
      "drill-beat-the-drift",
      "drill-space-then-contact",
    ],
  },
  {
    id: "preset-u11-defence-night",
    title: "Defence night",
    ageGroup: "u11",
    theme: "tackle",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-ankles-and-knees",
      "drill-double-tackle",
      "drill-tackle-the-offload",
      "drill-defend-the-ruck-edge",
      "drill-last-play",
    ],
  },
  {
    id: "preset-u11-scrums-and-free-kicks",
    title: "Scrums and free kicks",
    ageGroup: "u11",
    theme: "setpiece",
    sessionMinutes: 60,
    drillIds: [
      "warmup-scrum-shape-hold",
      "warmup-grip-and-drive",
      "drill-scrum-under-pressure",
      "drill-scrum-half-clearing-pass",
      "drill-free-kick-options",
      "drill-two-touch-attack",
    ],
  },
  {
    id: "preset-u11-sharp-hands",
    title: "Sharp hands",
    ageGroup: "u11",
    theme: "handling",
    sessionMinutes: 60,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-hospital-pass",
      "drill-spin-pass-build",
      "drill-square-and-pass",
      "drill-two-on-one-continuous",
      "drill-scoring-zones",
    ],
  },
  {
    id: "preset-u11-match-week",
    title: "Match week",
    ageGroup: "u11",
    theme: "gamesense",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-two-lap-and-in",
      "drill-free-kick-options",
      "drill-defend-the-ruck-edge",
      "drill-beat-the-drift",
      "drill-last-play",
    ],
  },

  // ---- U12. The lineout, the five player scrum, a full week's shape ----
  {
    id: "preset-u12-set-piece-day",
    title: "Set piece day",
    ageGroup: "u12",
    theme: "setpiece",
    sessionMinutes: 75,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-scrum-shape-hold",
      "warmup-lineout-lift-shape",
      "drill-five-player-scrum",
      "drill-lineout-throw-accuracy",
      "drill-lineout-uncontested",
      "drill-lineout-to-attack",
      "drill-restart-defence",
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
      "drill-fend-and-go",
      "drill-carry-into-space",
      "drill-turnover-to-try",
      "drill-space-then-contact",
      "drill-full-game-conditions",
    ],
  },
  {
    id: "preset-u12-defence-that-holds",
    title: "Defence that holds",
    ageGroup: "u12",
    theme: "tackle",
    sessionMinutes: 60,
    drillIds: [
      "warmup-move-and-brace",
      "warmup-tackle-tube-roll",
      "drill-choke-and-hold",
      "drill-double-tackle",
      "drill-tackle-the-offload",
      "drill-back-three-cover",
    ],
  },
  {
    id: "preset-u12-winning-it-back",
    title: "Winning the ball back",
    ageGroup: "u12",
    theme: "breakdown",
    sessionMinutes: 60,
    drillIds: [
      "warmup-grip-and-drive",
      "warmup-wrestle-for-the-ball",
      "drill-clear-the-threat",
      "drill-who-goes-in",
      "drill-defend-the-ruck-edge",
      "drill-ruck-to-ruck",
    ],
  },
  {
    id: "preset-u12-move-it-early",
    title: "Move it early",
    ageGroup: "u12",
    theme: "handling",
    sessionMinutes: 60,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-hospital-pass",
      "drill-spin-pass-build",
      "drill-blind-pass-drill",
      "drill-two-on-one-continuous",
      "drill-last-play",
    ],
  },
  {
    id: "preset-u12-getting-outside",
    title: "Getting outside them",
    ageGroup: "u12",
    theme: "evasion",
    sessionMinutes: 60,
    drillIds: [
      "warmup-three-corner-sprint",
      "warmup-two-lap-and-in",
      "drill-fend-and-go",
      "drill-beat-the-drift",
      "drill-back-three-cover",
      "drill-two-touch-attack",
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
