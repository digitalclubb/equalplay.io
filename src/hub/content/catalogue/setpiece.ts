import type { Drill } from "../types.js";

/**
 * The scrum and the restarts around it. Scrum from U10, per Regulation 15.
 *
 * The progression these follow: at U10 the scrum is three players, uncontested,
 * no push and only the putting-in hooker may strike. At U11 the strike becomes
 * contested but there is still no push. At U12 it goes to five players with two in
 * the second row, still no push.
 *
 * There is no lineout in here because there is no lineout at any grade the hub
 * covers. Reg 15 has touch restarting with a free pass all the way through U13
 * and the uncontested lineout arriving at U14, with lifting held back to U15.
 *
 * Nothing in here involves pushing. Not once, at any grade covered by the hub.
 */
export const SETPIECE: Drill[] = [
  {
    id: "drill-three-player-scrum-shape",
    title: "Three player scrum shape",
    kind: "exercise",
    themes: ["setpiece"],
    minAge: "u10",
    minutes: 10,
    players: { min: 6, max: 16 },
    space: "10 x 10 m",
    diagram: {
      label:
        "Set up diagram. Two three player front rows facing each other with the ball in the tunnel between them.",
      space: [10, 10],
      cones: [[0, 0], [10, 0], [0, 10], [10, 10]],
      defence: [[3.8, 4.3], [5, 4.3], [6.2, 4.3]],
      attack: [[3.8, 5.7], [5, 5.7], [6.2, 5.7]],
      ball: [[5, 5]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1 }],
    setup: "Two threes facing each other a metre apart. Hooker in the middle, a prop either side.",
    howItRuns:
      "Work the crouch, bind, set sequence with no push at all. At this grade the scrum is uncontested and it is there to restart the game, not to win a shoving match. Once the shape holds, add the scrum half rolling it in and the hooker striking. Ten goes then swap the front rows round.",
    coachingPoints: [
      "Flat backs and heads up on crouch. Looking at the grass means reset",
      "Bind onto your own player before you go near the opposition",
      "Nobody moves forward on set. Hold still and the ball comes in",
    ],
    progressions: ["Scrum half feeds and the hooker strikes and controls it"],
    regressions: ["No opposition, just the coach calling the sequence"],
    safety:
      "No pushing, ever, at this grade. Match front rows by size. Any collapse means everybody stands up and starts again from crouch. If a child does not want to be in the front row, they do not have to be.",
  },
  {
    id: "drill-scrum-half-feed",
    title: "Feed and strike",
    kind: "exercise",
    themes: ["setpiece", "handling"],
    minAge: "u10",
    minutes: 9,
    players: { min: 4, max: 16 },
    space: "10 x 10 m",
    diagram: {
      space: [10, 10],
      defence: [[3.4, 5.5], [5, 5.5], [6.6, 5.5]],
      attack: [[8.6, 4.6]],
      passes: [[[7.8, 4.6], [5.8, 4.6]], [[5.1, 4.7], [5.8, 7.2], -0.6]],
      ball: [[9.4, 6.2], [9.4, 3.2]],
    },
    equipment: [{ item: "ball", qty: 2 }],
    setup: "One three-player front row, set and holding. A scrum half with two balls.",
    howItRuns:
      "The feed goes in straight along the tunnel and the hooker strikes it back with the near foot. Twelve goes then change hookers. Every child in the squad has a go at hooking, because on a Sunday whoever turns up is who you have got.",
    coachingPoints: [
      "Feed it straight and along the ground, not up in the air",
      "Hooker keeps their bind while they strike",
      "Strike with the near foot and hook it back, do not kick at it",
    ],
    progressions: ["Add the second row channelling it back", "Feed at match pace"],
    regressions: ["Roll it in by hand with nobody bound", "Coach places the ball in the tunnel"],
    safety:
      "Nobody pushes. Front row stays bound and still. Stand everybody up between goes so nobody is holding a position for long.",
  },
  {
    id: "drill-scrum-and-away",
    title: "Scrum and away",
    kind: "exercise",
    themes: ["setpiece", "gamesense"],
    minAge: "u10",
    minutes: 10,
    players: { min: 8, max: 16 },
    space: "25 x 20 m",
    diagram: {
      space: [25, 20],
      cones: [[0, 0], [25, 0], [0, 10], [25, 10], [0, 20], [25, 20]],
      defence: [[3.8, 10.4], [5.7, 10.4], [7.6, 10.4], [16.5, 9], [21, 9.6]],
      attack: [
        [3.8, 12.4],
        [5.7, 12.4],
        [7.6, 12.4],
        [8.6, 14.6],
        [13.2, 15.5],
        [17, 16.5],
        [20.8, 17.3],
      ],
      runs: [[[13.2, 14.5], [13.4, 10.3]], [[17, 15.5], [17.6, 11.2]]],
      passes: [[[9.6, 14.8], [12.2, 15.3]], [[14.2, 15.7], [16, 16.3]]],
      ball: [[5.7, 14.1]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "A three-player scrum with a back line behind it and two defenders out wide.",
    howItRuns:
      "Set the scrum, feed, strike, then play. The point is the six seconds after the ball comes out, because a scrum won and then wasted is no better than a scrum lost. Eight goes then rotate everybody through the front row.",
    coachingPoints: [
      "Backs are set and looking before the feed goes in",
      "Nine gets to the ball as it comes out, not after it has stopped",
      "First receiver runs straight. The space is behind the scrum",
    ],
    progressions: ["Three defenders", "Scrum on the other side of the pitch"],
    regressions: ["No defenders at all", "Coach hands the ball to nine"],
    safety:
      "Uncontested, no push. Stand up between goes. Age grade rules for anything that happens after the ball comes out.",
  },
  {
    id: "drill-restart-receipt",
    title: "Taking the restart",
    kind: "exercise",
    themes: ["setpiece", "handling"],
    minAge: "u10",
    minutes: 9,
    players: { min: 6, max: 20 },
    space: "30 x 25 m",
    diagram: {
      space: [30, 25],
      cones: [[0, 0], [30, 0], [0, 10], [30, 10], [0, 25], [30, 25]],
      defence: [[9, 17], [18, 17], [4, 13.8], [22.5, 14.2], [27.5, 16], [8, 20], [20.5, 20.5]],
      attack: [[13.5, 12.8]],
      runs: [[[10, 15.9], [12.3, 13.6]], [[17, 15.9], [14.7, 13.6]]],
      passes: [[[15.5, 2.5], [13.9, 11.2], 1.5]],
      ball: [[19.5, 2.5], [22.5, 2.5]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }],
    setup: "A receiving team spread across the pitch. You throw or kick the restarts in.",
    howItRuns:
      "Ball goes up, somebody calls it, they catch it and two others get either side of them straight away. Ten restarts. Every match starts with one of these and most minis teams have never once practised it, which is why the first two minutes are always chaos.",
    coachingPoints: [
      "One voice calls it. Loud, early and use your own name",
      "Catch it above your head, do not let it come down to your chest",
      "Two players either side before the catcher lands",
    ],
    progressions: ["Chasers competing for it", "Restarts to different parts of the pitch"],
    regressions: ["Throw it gently and flat", "Nominate the catcher before each one"],
    safety:
      "Nobody jumps into anybody. If two children go for the same ball, stop it and sort out the calling before you carry on.",
  },
  {
    id: "drill-scrum-under-pressure",
    title: "Scrum with the clock on",
    kind: "exercise",
    themes: ["setpiece"],
    minAge: "u11",
    minutes: 9,
    players: { min: 6, max: 16 },
    space: "15 x 15 m",
    diagram: {
      label:
        "Set up diagram. Two three player front rows with a referee alongside and both hookers striking for the ball.",
      space: [15, 15],
      defence: [[6, 6.5], [7.5, 6.5], [9, 6.5], [12.2, 7.5]],
      attack: [[6, 8.5], [7.5, 8.5], [9, 8.5]],
      passes: [[[7, 7.8], [6, 10.8]], [[8, 7.2], [9, 4.2]]],
      ball: [[7.5, 7.5]],
    },
    equipment: [{ item: "ball", qty: 1 }],
    setup: "Two threes. A referee calling the sequence at a proper pace.",
    howItRuns:
      "Now the strike is contested, so both hookers are going for it, still with no push from anybody. Referee calls crouch, bind, set at match tempo and penalises anything early. Ten goes. Getting used to a referee's rhythm is half of not conceding free kicks on a Sunday.",
    coachingPoints: [
      "Listen for set. Moving on bind is a free kick",
      "Both hookers may strike now. Be ready for it",
      "Still no push. Hold the shape and contest the ball only",
    ],
    progressions: ["Referee varies the timing of the calls"],
    regressions: ["Uncontested strike", "Slower calls"],
    safety:
      "No push at U11. Contested strike means both hookers moving, so watch the bind stays intact. Match by size. Any collapse means everybody up and reset from crouch.",
  },
  {
    id: "drill-free-kick-options",
    title: "Free kick options",
    kind: "exercise",
    themes: ["gamesense"],
    minAge: "u11",
    minutes: 9,
    players: { min: 8, max: 21 },
    space: "30 x 25 m",
    diagram: {
      space: [30, 25],
      cones: [[0, 0], [30, 0], [0, 10], [30, 10], [0, 25], [30, 25]],
      defence: [[8, 9.6], [14, 9.6], [20, 9.6]],
      attack: [[10, 17], [8, 19], [12, 19], [17, 17.4], [22, 18]],
      runs: [[[10, 14.8], [10.2, 11.2]], [[22.2, 16.6], [24.6, 11.4]]],
      passes: [[[11.2, 17.2], [15.6, 17.3]]],
      ball: [[10, 15]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "A free kick or free pass position. Attacking team set up around it.",
    howItRuns:
      "Take it quickly, take it slowly, or take it wide. Three different plans, practised until each one is automatic. Six of each. Most minis restarts are a child looking around wondering what to do while the defence gets organised.",
    coachingPoints: [
      "Decide before you pick the ball up. Look up first",
      "Quick means quick. Two seconds, before they are set",
      "Everybody needs to know which of the three it is",
    ],
    progressions: ["Defence gets an extra player if you take longer than five seconds"],
    regressions: ["Coach calls which option to use", "No defence"],
  },
  {
    id: "drill-five-player-scrum",
    title: "Five player scrum",
    kind: "exercise",
    themes: ["setpiece"],
    minAge: "u12",
    minutes: 11,
    players: { min: 10, max: 20 },
    space: "15 x 15 m",
    diagram: {
      label:
        "Set up diagram. A five player pack either side, three in each front row and two bound on behind, with the ball channelled back.",
      space: [15, 15],
      defence: [[6, 6.5], [7.5, 6.5], [9, 6.5], [6.75, 4.9], [8.25, 4.9]],
      attack: [[6, 8.5], [7.5, 8.5], [9, 8.5], [6.75, 10.1], [8.25, 10.1]],
      passes: [[[6.4, 7.2], [5, 11.4], 2]],
      ball: [[7.5, 7.5]],
    },
    equipment: [{ item: "ball", qty: 1 }],
    setup: "Two fives. Three in the front row, two in the second row behind them.",
    howItRuns:
      "Same sequence, still no push, but now with two in the second row binding onto the front. Get the shape right static before anybody feeds. Then feed and channel the ball back through. Ten goes then rotate. The second row's whole job here is holding a shape, which is less exciting than they hoped and worth being honest about.",
    coachingPoints: [
      "Second row binds onto the props' shorts, heads to the side of their hips",
      "Everybody flat backed. One bent back and the shape goes",
      "Still nobody pushes. Hold and let the ball come through",
    ],
    progressions: ["Add the back line and play off it"],
    regressions: ["Three player scrum", "Static shape with no ball"],
    safety:
      "No pushing at U12 either. Second row heads go to the side of a hip, never into a backside or between two players. Match by size across both rows. Collapse means everybody up and reset. Nobody is made to be in a front row.",
  },
  {
    id: "drill-restart-defence",
    title: "Defending the restart",
    kind: "exercise",
    themes: ["setpiece", "gamesense"],
    minAge: "u12",
    minutes: 9,
    players: { min: 10, max: 22 },
    space: "35 x 30 m",
    diagram: {
      label:
        "Set up diagram. A chase line spread across the pitch behind the kick-off spot, going forward together as the ball goes up.",
      space: [35, 30],
      cones: [[0, 0], [35, 0], [0, 30], [35, 30], [0, 22], [35, 22]],
      attack: [[17.5, 22], [4, 22.6], [9, 22.6], [14, 22.6], [22, 22.6], [27, 22.6], [32, 22.6]],
      runs: [
        [[4, 21], [4.5, 12.5]],
        [[9, 21], [9.4, 12.5]],
        [[14, 21], [14.2, 12.5]],
        [[22, 21], [22.2, 12.5]],
        [[27, 21], [26.8, 12.5]],
        [[32, 21], [31.6, 12.5]],
      ],
      passes: [[[17.5, 20.4], [17, 8.5], 2.5]],
      ball: [[19, 25.5], [22.5, 25.5]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }],
    setup: "A chasing team lined up behind the kick-off spot.",
    howItRuns:
      "Kick or throw it up. The chasers go as a line, arriving together rather than in ones and twos. Ten goes. A chase line that arrives together wins the ball back. A chase line where the fastest child gets there four seconds early hands it over.",
    coachingPoints: [
      "Nobody sets off before the ball. Stay onside",
      "Go as a line. Look left and right as you run",
      "First one there does not have to catch it, just stop them going forward",
    ],
    progressions: ["Add a receiving team so it is a live contest"],
    regressions: ["Nobody receiving, just practise the line", "Walk the chase"],
    safety:
      "Nobody goes into a player who is off the ground with the ball. Wait for their feet to land. Stop it and reset if two children arrive at the same catch.",
  },
];
