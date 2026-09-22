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
    aim: "Nobody knows anybody yet. They get hands on a ball in the first five minutes then go home having run about with it.",
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
    aim: "They catch it and stop dead. By the end they should be taking the ball while they are still moving.",
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
    aim: "Everything here is about spotting a gap then going through it. Expect plenty of tags.",
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
    aim: "A night with almost no queueing. They play, you stop it now and then to ask what they saw.",
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
    aim: "One child with the ball against one defender, over and over, until changing direction stops being a surprise.",
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
    aim: "Catching and passing joined up. They can usually do each on its own, though not in the same second.",
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
    aim: "Their first game of the year is close. This one is about it not coming as a shock, so most of it is played rather than drilled.",
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
    aim: "They run with their eyes down. Every drill here makes them look up before they decide anything.",
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
    aim: "Their first tackles ever, so it starts on the knees then stays low and slow. Nobody gets hurt learning this.",
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
    aim: "Keeping hold of it in traffic. Most turnovers at this age are a dropped ball rather than anything the other lot did.",
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
    aim: "The space is usually out wide or behind them. This is about seeing it before somebody closes it.",
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
    aim: "Fewer instructions from you, more decisions from them. You will be quieter than usual by the end.",
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
    aim: "Rucking arrives this season. Staying on your feet is the whole thing and everything else follows from it.",
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
    aim: "The three player scrum plus the free pass. Dull to run, though it is most of what stops a game turning into a mess.",
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
    aim: "A tackle is not the end of anything now. They tackle, get up, then do the next thing.",
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
    aim: "Getting the ball away before the tackler arrives. Everything is timed or pressured so nobody can dawdle.",
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
    aim: "Beating the person in front of you with nobody coming to help. Support work comes later in the season.",
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
    aim: "A sharpener for match day. Nothing new goes in this week and most of it is played live.",
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
    aim: "Ball back fast off the floor. A slow ruck is what turns a promising attack into a queue.",
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
    aim: "Nine a side means room out wide they have never had. This one is about actually using it.",
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
    aim: "A whole night on defending. They will be tired, though tackling decides most games at this age.",
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
    aim: "Restarts done properly so the game keeps moving. Worth the half hour it takes.",
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
    aim: "Passing under a bit of pressure. The pass they can do in a line goes to pieces the moment somebody chases them.",
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
    aim: "Match day is close. Everything here is the game itself, stopped now and then when something is worth naming.",
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

  // ---- U12. The five player scrum, the restarts, a full week's shape ----
  {
    id: "preset-u12-set-piece-day",
    title: "Scrums and restarts",
    aim: "The five player scrum in its 3-2 shape plus the restarts around it. Nobody pushes at this grade, so the shape is the whole job.",
    ageGroup: "u12",
    theme: "setpiece",
    sessionMinutes: 75,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-scrum-shape-hold",
      "drill-five-player-scrum",
      "drill-scrum-half-feed",
      "drill-scrum-under-pressure",
      "drill-restart-receipt",
      "drill-free-kick-options",
      "drill-restart-defence",
    ],
  },
  {
    id: "preset-u12-match-week",
    title: "Match week",
    aim: "The last session before a game. Keep it lively then finish early rather than grinding them into the ground.",
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
    aim: "One tackler missing is a try at this age. Tonight is about the line staying joined up.",
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
    aim: "Getting the ball back once the other lot have it, on their feet and through the gate every time.",
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
    aim: "They hang on too long. Every drill here rewards the pass made before the defender gets there.",
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
    aim: "Beating them on the outside, which needs the pass and the run to arrive together.",
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
  // ---- Kicking, U11 and U12. The theme that arrives last ----
  {
    id: "preset-u11-kicking-night",
    title: "The boot arrives",
    aim: "The first season a boot is allowed near the ball. Most of it is catching, because a kick nobody gathers is a gift.",
    ageGroup: "u11",
    theme: "kicking",
    sessionMinutes: 60,
    drillIds: [
      "warmup-high-ball-hands",
      "warmup-two-lap-and-in",
      "drill-punt-to-your-partner",
      "drill-grubber-into-space",
      "drill-take-the-high-ball",
      "drill-last-play",
    ],
  },
  {
    id: "preset-u12-kick-and-counter",
    title: "Kick and counter",
    aim: "Kicking plus what happens when it comes back. A kick is a decision now rather than a way out of trouble.",
    ageGroup: "u12",
    theme: "kicking",
    sessionMinutes: 60,
    drillIds: [
      "warmup-high-ball-hands",
      "warmup-three-corner-sprint",
      "drill-take-the-high-ball",
      "drill-drop-kick-restart",
      "drill-kick-or-run",
      "drill-counter-from-the-catch",
    ],
  },

  // ---- One carousel per grade. Stations running at once, groups going round ----
  //
  // Twenty children and four parents helping is four groups of five rather
  // than twenty children queueing for a turn. Every session above this one
  // runs one drill at a time, so a coach with helpers had nothing to start
  // from and built the Sunday shape from scratch every week.
  //
  // Each of these is one theme at every station, so the badge stays honest and
  // the three things worth saying all night hold at whichever station a coach
  // is standing on. The stations are drills a group of five can run in a
  // corner of a pitch, which is what `content-age-gate.test.ts` holds them to.
  {
    id: "preset-u7-carousel",
    title: "Nobody queues",
    aim: "Three groups with a grown-up each, so the ball is in every pair of hands all night rather than in a line.",
    ageGroup: "u7",
    theme: "handling",
    sessionMinutes: 45,
    drillIds: [
      "warmup-name-and-pass",
      "warmup-two-ball-square",
      ["drill-catch-and-turn", "drill-two-hand-relay", "drill-pass-down-the-line"],
      "drill-end-ball",
    ],
  },
  {
    id: "preset-u8-carousel",
    title: "Three ways past",
    aim: "The same job at three stations, so a child gets dozens of goes at beating somebody instead of two.",
    ageGroup: "u8",
    theme: "evasion",
    sessionMinutes: 45,
    drillIds: [
      "warmup-tail-snatch",
      "warmup-follow-the-leader",
      ["drill-side-step-slalom", "drill-shadow-and-step", "drill-one-on-one-channel"],
      "drill-drop-off-touch",
    ],
  },
  {
    id: "preset-u9-carousel",
    title: "Tackling in threes",
    aim: "Their first contact season run as small groups, which is how a volunteer watches every tackle rather than a line of twenty.",
    ageGroup: "u9",
    theme: "tackle",
    sessionMinutes: 60,
    drillIds: [
      "warmup-down-and-up",
      "warmup-shoulder-to-shield",
      ["drill-tackle-and-get-up", "drill-side-on-tackle", "drill-track-and-close"],
      "drill-scoring-zones",
    ],
  },
  {
    id: "preset-u10-carousel",
    title: "Three rucks at once",
    aim: "Everything that happens on the floor, split three ways, so nobody is stood about waiting for a go at it.",
    ageGroup: "u10",
    theme: "breakdown",
    sessionMinutes: 60,
    drillIds: [
      "warmup-wrestle-for-the-ball",
      "warmup-body-position-ladder",
      ["drill-step-over-and-stay", "drill-turn-the-turtle", "drill-pick-and-go"],
      "drill-three-phase-game",
    ],
  },
  {
    id: "preset-u11-carousel",
    title: "Three balls in the air",
    aim: "One ball between four beats one ball between twenty. Kicking and catching at three stations with a grown-up on each.",
    ageGroup: "u11",
    theme: "kicking",
    sessionMinutes: 60,
    drillIds: [
      "warmup-high-ball-hands",
      "warmup-two-lap-and-in",
      ["drill-take-the-high-ball", "drill-punt-to-your-partner", "drill-grubber-into-space"],
      "drill-last-play",
    ],
  },
  {
    id: "preset-u12-carousel",
    title: "Four stations of hands",
    aim: "Four bits of passing running at the same time, which is four times the touches inside the same hour.",
    ageGroup: "u12",
    theme: "handling",
    sessionMinutes: 60,
    drillIds: [
      "warmup-two-lap-and-in",
      "warmup-partner-mirror",
      [
        "drill-spin-pass-build",
        "drill-blind-pass-drill",
        "drill-pop-pass-gates",
        "drill-loop-and-go",
      ],
      "drill-last-play",
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
