import type { Drill } from "../types.js";

/**
 * Kicking and catching. U11 and up, per Regulation 15.
 *
 * The boot arrives at U11 after four seasons of none, which makes this the one
 * theme where a whole age group is starting from nothing on the same night. So
 * these run in the order a coach would meet them: get the ball onto the foot,
 * then get it into a space, then catch one coming the other way, then decide
 * whether to kick at all.
 *
 * Two things Reg 15 rules out at both grades. No box kicks and no drop goals,
 * so nothing in here coaches either. Conversions are out as well, which is why
 * there is no place kicking: a U11 who can punt has something to use on a
 * Sunday, a U11 who can strike off a tee has nowhere to put it.
 *
 * A restart is a drop kick from U11. That is a kick and a set piece at the same
 * time, so "Kick off and chase" claims both themes.
 */
export const KICKING: Drill[] = [
  {
    id: "drill-punt-to-your-partner",
    title: "Punt to your partner",
    kind: "exercise",
    themes: ["kicking"],
    minAge: "u11",
    minutes: 8,
    players: { min: 4, max: 24 },
    space: "20 m channel",
    diagram: {
      label:
        "Set up diagram. A pair twenty metres apart with a cone at each of their feet. One of them is kicking the ball down to the other.",
      space: [12, 20],
      cones: [[3, 17], [9, 17], [3, 3], [9, 3]],
      attack: [[6, 17]],
      defence: [[6, 3]],
      passes: [[[6, 15.5], [6, 4.5]]],
      ball: [[7.6, 17]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs facing each other twenty metres apart, a cone either side of where each of them stands.",
    howItRuns:
      "Kick it to your partner so they can catch it without moving their feet. Ten each, then ten more with a step in first. Almost every miskick at this age is the drop rather than the leg, so watch the hands: the ball wants pointing at the ground and letting go, not throwing up. Anybody launching it over their partner's head goes back to holding the ball out at arm's length and dropping it straight onto the laces.",
    coachingPoints: [
      "Hold it out in front, point it at the ground, let it go",
      "Strike it with the hard bit of your boot, not your toe",
      "Follow through at your partner. Your foot ends up pointing at them",
    ],
    progressions: [
      "Two steps and kick, then off a jog",
      "Kick to land in front of your partner so they run onto it",
    ],
    regressions: ["Ten metres apart", "Drop it onto the foot from a standing start with no run up"],
    faults: [
      {
        looks: "The ball tossed upwards out of the hands before the foot arrives",
        say: "Drop it. Do not throw it. Let go and let it fall",
      },
      {
        looks: "The ball spinning off sideways every time",
        say: "Point the end of the ball at the floor before you let go",
      },
    ],
  },
  {
    id: "drill-grubber-into-space",
    title: "Grubber into the space",
    kind: "exercise",
    themes: ["kicking", "evasion"],
    minAge: "u11",
    minutes: 9,
    players: { min: 6, max: 18 },
    space: "25 x 15 m",
    diagram: {
      label:
        "Set up diagram. A kicker rolling the ball along the ground through a gate ten metres ahead, with a partner beside them already chasing it.",
      space: [15, 25],
      cones: [[0, 25], [15, 25], [5, 14], [10, 14], [0, 0], [15, 0]],
      attack: [[7, 22]],
      defence: [[10, 21.5]],
      passes: [[[7, 20.5], [7.4, 9]]],
      runs: [[[10.4, 20.3], [8.6, 10.5]]],
      ball: [[4.2, 22]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }],
    setup: "A gate of two cones ten metres ahead of the kicker, with the rest of the square marked out beyond it.",
    howItRuns:
      "Roll the ball along the floor through the gate so your partner can run onto it. They gather it and score at the far end. Six each, swapping over. A grubber is the first kick worth having at this age because a ball on the floor cannot be caught by a defender and a bad one still goes forward. Keep asking whether the chaser had to break stride: if they did, the kick was wrong however good it looked.",
    coachingPoints: [
      "Ball pointing down, strike the top half so it stays low",
      "Kick it in front of them, not at them",
      "Chaser starts moving as the foot goes through",
    ],
    progressions: ["A defender stands in the gate", "Kick with the outside foot"],
    regressions: ["Widen the gate", "Roll it by hand first so the chase works"],
    faults: [
      {
        looks: "The ball bouncing up over the chaser's head",
        say: "Hit the top of the ball. Keep it on the grass",
      },
      {
        looks: "The chaser stopping and turning back for a ball behind them",
        say: "Put it where they are running, a couple of strides ahead",
      },
    ],
  },
  {
    id: "drill-take-the-high-ball",
    title: "Take the high ball",
    kind: "exercise",
    themes: ["kicking", "handling"],
    minAge: "u11",
    minutes: 10,
    players: { min: 6, max: 18 },
    space: "20 x 15 m",
    diagram: {
      label:
        "Set up diagram. A server kicking the ball high to a catcher fifteen metres away, with one chaser running down on the catcher.",
      space: [15, 20],
      cones: [[4, 17], [11, 17], [4, 4], [11, 4]],
      attack: [[7.5, 17]],
      defence: [[7.5, 4], [11, 15]],
      passes: [[[7.5, 15.5], [7.5, 5.5]]],
      runs: [[[11, 13.6], [8.8, 6]]],
      ball: [[9, 17]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }],
    setup: "A catcher on a cone with a server fifteen metres away and one chaser beside the server.",
    howItRuns:
      "Serve it high so it comes down on the catcher. First round nobody chases. Second round the chaser jogs down and stops an arm's length away. Only once the catch is clean does the chaser get to run in properly. Shout your call every time, because at U11 a knock on from a high ball is a free pass to the other side rather than a scrum, so the ball on the floor costs you the ball.",
    coachingPoints: [
      "Call it early and loud. Mine, every time",
      "Watch it all the way into your hands, then pull it into your chest",
      "Turn side on as it arrives so nobody hits you square",
    ],
    progressions: [
      "Two chasers, one either side",
      "Catcher starts with their back turned and spins on the call",
    ],
    regressions: ["Throw it rather than kick it", "No chaser at all"],
    faults: [
      {
        looks: "Arms straight up with the elbows locked, so the ball bounces off",
        say: "Soft hands. Let it come in and pull it into your chest",
      },
      {
        looks: "Nobody says anything and two of them arrive together",
        say: "Shout mine before it comes down. Loudest voice takes it",
      },
    ],
  },
  {
    id: "drill-drop-kick-restart",
    title: "Kick off and chase",
    kind: "exercise",
    themes: ["kicking", "setpiece"],
    minAge: "u11",
    minutes: 10,
    players: { min: 8, max: 20 },
    space: "30 x 20 m",
    diagram: {
      label:
        "Set up diagram. A kicker on the halfway cones drop kicking over a line seven metres ahead, with a chaser beside them and two receivers waiting beyond it.",
      space: [20, 30],
      cones: [[0, 22], [20, 22], [0, 15], [20, 15], [0, 0], [20, 0]],
      attack: [[10, 22], [13, 21]],
      defence: [[7, 9], [13, 9]],
      passes: [[[10, 20.5], [8.5, 10.4]]],
      runs: [[[13.2, 19.6], [11.5, 12]]],
      ball: [[12.8, 22]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }],
    setup:
      "A halfway line of cones with a second line seven metres beyond it. Two receivers wait past that.",
    howItRuns:
      "Drop kick from halfway. It has to cross the seven metre line or the other side gets the choice of a re-kick or a scrum on halfway, which is worth saying out loud once so they know why the line is there. The chaser goes the moment the foot connects. Receivers catch it and run it back. Everybody kicks at least twice, because on a Sunday the one child who can do it will not always be on the pitch.",
    coachingPoints: [
      "Drop it on its point and hit it as it touches the grass",
      "Aim for the space, not for a player",
      "Chase in a line with the kicker. Nobody sets off early",
    ],
    progressions: ["Kick to a nominated corner", "Receivers get a two pass counter before you stop it"],
    regressions: ["Punt it rather than drop kick it", "No chasers, just the catch"],
    safety:
      "Nobody touches a player who is off the ground. The chaser stops and waits for both feet to land every time. Stop the drill for anybody who does not. No lifting and no jumping into a chaser. Reg 15 has no contest in the air at this grade and neither does this.",
    faults: [
      {
        looks: "The ball struck out of the hands before it hits the ground",
        say: "Let it land first. Hit it off the bounce, not out of your hands",
      },
      {
        looks: "Chasers strung out with one twenty metres ahead of the rest",
        say: "Stay level with each other. Go when the boot goes",
      },
    ],
  },
  {
    id: "drill-kick-or-run",
    title: "Kick it or run it",
    kind: "exercise",
    themes: ["kicking", "gamesense"],
    minAge: "u12",
    minutes: 11,
    players: { min: 8, max: 20 },
    space: "30 x 20 m",
    diagram: {
      label:
        "Set up diagram. A carrier with support facing two defenders, with a running line into the gap beside them and a kick over the top drawn as the other option.",
      space: [20, 30],
      cones: [[0, 30], [20, 30], [0, 18], [20, 18], [0, 0], [20, 0]],
      attack: [[8, 24], [13, 25]],
      defence: [[6, 17.5], [14, 17.5]],
      runs: [[[8.4, 22.6], [10, 13]]],
      passes: [[[7, 23.2], [4, 8]]],
      ball: [[5.2, 24]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }],
    setup: "A line of cones across the middle for the defenders to start on, with a try line at each end.",
    howItRuns:
      "Two attackers against two defenders. The defenders are told, quietly, whether to rush up or to sit back. The attackers are told nothing. Rush up and there is grass behind them worth a kick. Sit back and there is grass in front worth running at. Eight goes, then swap. The only question you ask afterwards is what they saw, because a good decision off a bad read is luck.",
    coachingPoints: [
      "Look at the defenders' feet. Coming forward or standing still",
      "Grass behind them is a kick. Grass in front of them is a run",
      "Whoever is not carrying calls it. The carrier has enough to do",
    ],
    progressions: ["Three against three", "Defenders choose for themselves rather than being told"],
    regressions: ["Tell the attackers as well, so they get the shape first", "Walk it through once"],
    faults: [
      {
        looks: "A kick every time whatever the defenders do",
        say: "Only kick it if there is nobody left back there. Otherwise run",
      },
      {
        looks: "Head down running into the first defender with a gap two metres over",
        say: "Head up before you get there. Tell me what you saw",
      },
    ],
  },
  {
    id: "drill-counter-from-the-catch",
    title: "Counter from the catch",
    kind: "exercise",
    themes: ["kicking", "gamesense"],
    minAge: "u12",
    minutes: 11,
    players: { min: 8, max: 20 },
    space: "30 x 20 m",
    diagram: {
      label:
        "Set up diagram. Three players spread across the back waiting on a kick from the far end, with two chasers already coming down on them.",
      space: [20, 30],
      cones: [[0, 30], [20, 30], [0, 0], [20, 0], [10, 26]],
      attack: [[4, 22], [10, 24], [16, 22]],
      defence: [[10, 3], [7, 10], [13, 10]],
      passes: [[[10, 4.4], [10, 22.4]]],
      runs: [[[7, 11.4], [8.4, 17]], [[13, 11.4], [11.6, 17]]],
      ball: [[12.8, 3]],
    },
    equipment: [{ item: "cone", qty: 5 }, { item: "ball", qty: 2 }],
    setup:
      "Three at the back spread across the width, two chasers halfway, one kicker at the far end. A cone marks where the catcher stands.",
    howItRuns:
      "The kick goes up, somebody at the back takes it, then the three of them have to get past the two chasers and back over halfway. The catch is only the start of it. What most sides do here is catch it and boot it straight back, which hands the ball over for nothing, so the rule is that the ball has to be passed at least once before it can be kicked again. Six goes, rotate everybody through the back three.",
    coachingPoints: [
      "Call it, take it, then get moving before they arrive",
      "The other two run to either side of the catcher, not behind them",
      "Go away from the chasers. Wide grass beats a hole up the middle",
    ],
    progressions: ["Three chasers", "The catch has to be taken above head height"],
    regressions: ["One chaser", "Serve it by hand so the catch is easy"],
    faults: [
      {
        looks: "The two who did not catch it standing still watching",
        say: "Get either side of them. They need somebody to pass to",
      },
      {
        looks: "The catcher stopping dead on the spot with the ball held in",
        say: "Catch it moving. Take a step before you look up",
      },
    ],
  },
];
