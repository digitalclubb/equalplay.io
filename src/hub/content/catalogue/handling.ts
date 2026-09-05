import type { Drill } from "../types.js";

/** Passing, catching and looking after the ball. See docs/content-sourcing.md. */
export const HANDLING: Drill[] = [
  {
    id: "drill-two-hand-relay",
    title: "Two hand relay",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u7",
    minutes: 8,
    players: { min: 6, max: 24 },
    space: "20 m channel",
    diagram: {
      label:
        "Set up diagram. Four relay lines with a turning cone ten metres ahead of each line. The runner at the front of each line is on their way out to it.",
      space: [12, 20],
      cones: [[1.5, 16], [4.5, 16], [7.5, 16], [10.5, 16], [1.5, 6], [4.5, 6], [7.5, 6], [10.5, 6]],
      attack: [[1.5, 11], [4.5, 11], [7.5, 11], [10.5, 11]],
      defence: [[1.5, 18.2], [4.5, 18.2], [7.5, 18.2], [10.5, 18.2]],
      runs: [
        [[0.8, 15], [0.8, 7.4]],
        [[2.4, 7.4], [2.4, 15]],
      ],
      ball: [[1.5, 12.6]],
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Teams of four in lines. A turning cone ten metres out from each line.",
    howItRuns:
      "Run to the cone, round it, back, hand the ball over with two hands. Not a throw, a hand over. First team with everyone sat down wins. Three races. The only thing you are coaching is that the ball is carried in two hands and given properly, because at this age a one handed carry is where every dropped ball starts.",
    coachingPoints: [
      "Two hands on the ball. Both of them, all the way",
      "Hand it over, do not throw it",
      "Look at the person you are giving it to",
    ],
    progressions: ["Carry two balls", "Round the cone the other way so they turn both directions"],
    regressions: ["Shorter run", "Walk it once through first"],
    faults: [
      {
        looks: "One hand on the ball the moment they start running",
        say: "Two hands. If it drops, walk the next one",
      },
      {
        looks: "The ball thrown at the next child rather than handed over",
        say: "Put it in their hands. You should be able to feel them take it",
      },
    ],
  },
  {
    id: "drill-pass-down-the-line",
    title: "Pass down the line",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u7",
    minutes: 8,
    players: { min: 6, max: 21 },
    space: "20 x 15 m",
    diagram: {
      label:
        "Set up diagram. Three players side by side moving up a channel passing along the line. The next group waits behind them.",
      space: [15, 20],
      cones: [[3, 17.5], [7.5, 17.5], [12, 17.5], [3, 2.5], [7.5, 2.5], [12, 2.5]],
      attack: [[5, 15], [7.5, 15], [10, 15]],
      defence: [[5, 18.6], [7.5, 18.6], [10, 18.6]],
      runs: [
        [[5, 13.8], [5, 4.6]],
        [[7.5, 13.8], [7.5, 4.6]],
        [[10, 13.8], [10, 4.6]],
      ],
      passes: [
        [[5.9, 15], [6.6, 15]],
        [[8.4, 15], [9.1, 15]],
      ],
      ball: [[5, 13.6]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "Threes side by side, three metres apart, at one end of a channel.",
    howItRuns:
      "Walk forward together passing along the line. Reach the far cones, turn round, come back the other way. Six lengths. Then jog it. Keep the line flat, because the second one child runs ahead the pass has to go forward and it all falls apart. Point that out once, then let them feel it.",
    coachingPoints: [
      "Stay level with each other. Nobody races ahead",
      "Pass across your body with your fingers, not a swing of the arms",
      "Hands up and out before it comes to you",
    ],
    progressions: ["Jog it", "Fours instead of threes so the ball travels further"],
    regressions: ["Walk it", "Two metres apart instead of three"],
    faults: [
      {
        looks: "One child a metre ahead of the rest, so the pass has to go forward",
        say: "Stop. Get level, then walk again",
      },
      {
        looks: "Hands hanging by their sides until the ball arrives",
        say: "Hands up and out. Give them a target to hit",
      },
    ],
  },
  {
    id: "drill-corner-ball",
    title: "Corner ball",
    kind: "exercise",
    themes: ["handling", "gamesense"],
    minAge: "u7",
    minutes: 10,
    players: { min: 8, max: 20 },
    space: "20 x 20 m",
    diagram: {
      space: [20, 20],
      zones: [["tl", 6], ["tr", 6]],
      cones: [[0, 0], [20, 0], [0, 20], [20, 20], [6, 0], [0, 6], [14, 0], [20, 6]],
      defence: [[4, 9], [9, 7], [13, 8], [17, 10], [7, 12], [11.5, 12]],
      attack: [[3, 16], [7, 18], [10, 16.5], [14, 18], [17, 16], [13, 14.5]],
      runs: [
        [[9, 16], [4, 6], -1.6],
        [[12, 16], [16, 6], -1.6],
      ],
      ball: [[10, 15]],
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup:
      "A square with a scoring box in each far corner. Two teams. Score by putting the ball down in either box.",
    howItRuns:
      "Touch rules with no contest at the touch. Hand it back, play on from there. Two scoring corners instead of one line means the defence has to spread out, so the attack starts looking for the empty one on its own. Four minute games, change the teams round.",
    coachingPoints: [
      "Before you get the ball, look at which corner has fewer defenders",
      "Straighten up and hold a defender before you pass",
      "Support either side of the carrier, do not follow behind them",
    ],
    progressions: ["One touch then the ball must move within three seconds", "A third scoring corner"],
    regressions: ["More attackers than defenders", "Bigger square"],
    faults: [
      {
        looks: "Everybody piling towards whichever corner the ball is nearest",
        say: "Look at both corners before you get it. Which one is emptier?",
      },
      {
        looks: "Support running behind the carrier instead of beside them",
        say: "Get level and a bit wide. Behind them is no use",
      },
    ],
  },
  {
    id: "drill-catch-and-turn",
    title: "Catch and turn",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u7",
    minutes: 7,
    players: { min: 6, max: 18 },
    space: "10 x 10 m",
    diagram: {
      label: "Set up diagram. Three pairs five metres apart, each throwing a high ball to their partner.",
      space: [10, 10],
      attack: [[2, 3], [5, 3], [8, 3]],
      defence: [[2, 8], [5, 8], [8, 8]],
      passes: [
        [[2, 3.9], [2, 7.1]],
        [[5, 3.9], [5, 7.1]],
        [[8, 3.9], [8, 7.1]],
      ],
    },
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs, five metres apart, one ball each pair.",
    howItRuns:
      "Throw it up above their head so they have to reach. They catch, turn, put the ball on the floor behind them, pick it up, throw it back. Twenty each. Reaching for a high ball with both hands is a habit and this is how you build it without anybody feeling tested.",
    coachingPoints: [
      "Reach up for it. Do not wait for it to come down to your chest",
      "Fingers spread, thumbs together on a high one",
      "Watch it all the way in",
    ],
    progressions: ["Throw it slightly to one side so they have to move", "Catch it above your head"],
    regressions: ["Closer together", "Throw it chest high"],
    faults: [
      {
        looks: "Waiting with the arms tucked in for the ball to arrive",
        say: "Reach up and meet it. Take it at the top",
      },
      {
        looks: "Palms flat so the ball bounces off",
        say: "Spread your fingers. Thumbs together, make a W",
      },
    ],
  },
  {
    id: "drill-pop-pass-gates",
    title: "Pop pass gates",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u8",
    minutes: 8,
    players: { min: 6, max: 18 },
    space: "20 x 10 m",
    diagram: {
      space: [10, 20],
      cones: [[4, 15.5], [6, 15.5], [4, 11.5], [6, 11.5], [4, 7.5], [6, 7.5], [4, 3.5], [6, 3.5]],
      attack: [[3.4, 18.4], [6.6, 18.8]],
      runs: [
        [[3.4, 17.4], [3.2, 2.2]],
        [[6.6, 17.8], [5, 2.2], 1.2],
      ],
      passes: [[[3.8, 14.4], [4.7, 14.1]]],
      ball: [[3.4, 17.5]],
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Four gates of two cones, two metres wide, spread up a channel. Pairs at the start.",
    howItRuns:
      "Run at each gate together. The carrier goes to one side of it, the support runs through it and takes a short pass off the hip. Four gates, then swap who carries. Six goes each. This is the pass they will actually use at a ruck in two years, so it is worth getting the timing early.",
    coachingPoints: [
      "Short and soft. A pop is not a spin pass",
      "Support runs onto it at pace, do not slow down for it",
      "Give it late. Too early and the defender reads it",
    ],
    progressions: ["Add a defender in one gate who can only stand still"],
    regressions: ["Wider gates", "Walk through the first two gates"],
    faults: [
      {
        looks: "The pass thrown hard, so the receiver has to check",
        say: "Softer. Just lift it into their hands",
      },
      {
        looks: "The support runner slowing down to collect it",
        say: "Run onto it. Full speed through the gate",
      },
    ],
  },
  {
    id: "drill-numbers-up",
    title: "Numbers up",
    kind: "exercise",
    themes: ["gamesense", "handling"],
    minAge: "u8",
    minutes: 12,
    players: { min: 9, max: 21 },
    space: "25 x 20 m",
    diagram: {
      space: [25, 20],
      cones: [[0, 0], [25, 0], [0, 10], [25, 10], [0, 20], [25, 20]],
      attack: [[8, 14], [12.5, 14.6], [17, 15.2]],
      defence: [[10, 8], [15, 8.4]],
      runs: [
        [[8, 13], [7.5, 5]],
        [[12.5, 13.6], [12.5, 5]],
        [[17, 14.2], [18, 5]],
      ],
      passes: [
        [[9.2, 14.2], [11.3, 14.4]],
        [[13.7, 14.8], [15.8, 15]],
      ],
      ball: [[8, 12.8]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup:
      "Three attackers against two defenders across a channel. Everyone else waits behind the line and rotates in.",
    howItRuns:
      "One go to score. Score and they go again with the same numbers. Get stopped and the defence gets an extra player next go. Keep going until the defence is winning then reset to three against two. The attackers have to see the spare player and use them before the space shuts.",
    coachingPoints: [
      "Count the defence out loud before you start. Say the number",
      "Run at the inside shoulder to commit your defender",
      "Pass early enough that they still have space to run into",
    ],
    progressions: ["Four against three in a wider channel", "Defence starts a metre closer"],
    regressions: ["Three against one", "Defenders may only move sideways"],
    faults: [
      {
        looks: "Passing straight away without looking at the defence",
        say: "Count them out loud first. How many are there?",
      },
      {
        looks: "Running sideways looking for space instead of at a defender",
        say: "Run at their inside shoulder. Make them pick you",
      },
    ],
  },
  {
    id: "drill-loop-and-go",
    title: "Loop and go",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u8",
    minutes: 9,
    players: { min: 6, max: 18 },
    space: "20 x 15 m",
    diagram: {
      space: [15, 20],
      cones: [[0, 0], [15, 0], [0, 10], [15, 10], [0, 20], [15, 20]],
      attack: [[5.5, 16], [9, 16]],
      defence: [[7.5, 9]],
      runs: [[[5.5, 15], [11.5, 13.4], -2.6]],
      passes: [
        [[6.4, 16], [8.1, 16]],
        [[9.8, 15.2], [11, 14]],
      ],
      ball: [[5.5, 14.8]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "Pairs at one end of a channel, one defender halfway up who can walk forwards only.",
    howItRuns:
      "Carrier passes, then runs round behind the receiver to take it straight back. Two passes, one defender beaten. Six goes each way. The first time it works properly they will look genuinely pleased with themselves, which is the best reason to do it.",
    coachingPoints: [
      "Pass then move. Do not stand and admire it",
      "Go round behind them, close enough to take it back easily",
      "Receiver holds the defender for a beat before giving it back",
    ],
    progressions: ["Two defenders", "The loop has to happen at pace with no slowing down"],
    regressions: ["No defender at all to start", "Walk the pattern first"],
    faults: [
      {
        looks: "Standing still after the pass to watch what happens",
        say: "Pass, then go. You are the next runner",
      },
      {
        looks: "Looping so wide the ball cannot get back",
        say: "Closer. Almost brushing their shoulder as you go round",
      },
    ],
  },
  {
    id: "drill-switch-pass",
    title: "Switch",
    kind: "exercise",
    themes: ["handling", "evasion"],
    minAge: "u9",
    minutes: 9,
    players: { min: 6, max: 18 },
    space: "20 x 15 m",
    diagram: {
      space: [15, 20],
      cones: [[0, 0], [15, 0], [0, 10], [15, 10], [0, 20], [15, 20]],
      attack: [[5.5, 16], [9.5, 16]],
      defence: [[7.5, 8]],
      runs: [
        [[5.5, 15], [11, 10.5]],
        [[9.5, 15], [4, 10.5]],
      ],
      passes: [[[8.1, 12.9], [6.9, 12.9]]],
      ball: [[5.5, 14.8]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "Pairs running up a channel with one defender halfway who may walk forward only.",
    howItRuns:
      "The carrier runs one way. The support runner cuts back behind them the other way and the ball changes hands as they cross. Six goes each. It only works if the carrier takes the defender wide first, so if it keeps failing that is why.",
    coachingPoints: [
      "Carrier goes wide first to drag the defender across",
      "Support cuts behind, close enough to take it easily",
      "Hide the ball from the defender as it changes hands",
    ],
    progressions: ["Two defenders", "Threes so there is a dummy switch option"],
    regressions: ["No defender", "Walk the pattern through first"],
    faults: [
      {
        looks: "The two runners crossing too far apart for the handover",
        say: "Nearly touching as you pass each other",
      },
      {
        looks: "The ball held out in front where the defender can see it",
        say: "Hide it. Keep it on the far hip until they have gone past",
      },
    ],
  },
  {
    id: "drill-under-pressure-hands",
    title: "Under pressure hands",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u9",
    minutes: 10,
    players: { min: 8, max: 20 },
    space: "20 x 20 m",
    diagram: {
      space: [20, 20],
      cones: [[0, 0], [20, 0], [0, 20], [20, 20]],
      attack: [[5, 6], [11, 4.5], [16, 8], [4, 14], [13, 16]],
      defence: [[8.5, 8.5], [14, 12], [8, 12.5], [17, 4], [10.5, 18]],
      passes: [
        [[5.9, 6.4], [10.1, 4.9]],
        [[15.6, 8.9], [13.6, 15]],
      ],
      ball: [[5, 5], [16, 7]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }],
    setup: "Two teams in a square. One team has both balls.",
    howItRuns:
      "Keep the ball for ten passes to score a point. Defenders can touch the carrier. A touch means the ball goes down for the other team to pick up. Two balls at once so nobody hides. Four minute games. Hands go to pieces under pressure, which is exactly why you practise them under pressure.",
    coachingPoints: [
      "Move after you pass. A stood still player is no use",
      "Pass before the touch, not as it lands",
      "Talk. Tell them where you are",
    ],
    progressions: ["Eight passes instead of ten so it is quicker", "Smaller square"],
    regressions: ["Five passes", "One ball", "Defenders start two steps back"],
    faults: [
      {
        looks: "Standing still once they have passed",
        say: "Move after every pass. Nobody stays put",
      },
      {
        looks: "Silence, so the carrier has to turn round to find anybody",
        say: "Shout for it. Say your own name",
      },
    ],
  },
  {
    id: "drill-offload-in-the-tackle",
    title: "Offload in the tackle",
    kind: "exercise",
    themes: ["handling", "tackle"],
    minAge: "u10",
    minutes: 10,
    players: { min: 6, max: 18 },
    space: "15 x 15 m",
    softGround: true,
    diagram: {
      space: [15, 15],
      shields: [[7.5, 6]],
      attack: [[7.5, 10], [10.2, 12.4]],
      runs: [
        [[7.5, 9.1], [7.5, 7.2]],
        [[10.2, 11.5], [9.6, 7.6]],
      ],
      passes: [[[8.1, 7.4], [9.2, 7.3]]],
      ball: [[7.5, 9]],
    },
    equipment: [{ item: "ball", qty: 1, per: "pair" }, { item: "tackle shield", qty: 1, per: "pair" }],
    setup: "Threes. A shield holder, a carrier and a support runner three metres behind.",
    howItRuns:
      "The carrier walks into the shield, stays on their feet and pops the ball to the support runner arriving on their shoulder. Then jog it. Six each. They are learning to keep their hands free in contact rather than curling up round the ball the second they get held.",
    coachingPoints: [
      "Take the contact on the shoulder, keep the ball in two hands",
      "Support arrives late and loud so you know they are there",
      "Pop it before you go to ground, not after",
    ],
    progressions: ["Carrier gets held by two shields", "Support arrives from the other side"],
    regressions: ["Walk the whole thing", "Support stands still and calls for it"],
    safety:
      "Shield holders brace and absorb, never drive. Contact at hip height only. Nobody goes to ground in this one, so stop it if it turns into a wrestle.",
    faults: [
      {
        looks: "Going to ground first and then trying to pass",
        say: "Pop it before you go down. Standing up, not falling",
      },
      {
        looks: "Support arriving early and stopping alongside",
        say: "Come late and fast. Arrive as they hit it",
      },
    ],
  },
  {
    id: "drill-square-and-pass",
    title: "Square and pass",
    kind: "exercise",
    themes: ["handling", "gamesense"],
    minAge: "u10",
    minutes: 10,
    players: { min: 8, max: 21 },
    space: "30 x 20 m",
    // Two frames, because the drill is a change rather than a shape. Drawn as
    // one picture only the second half shows, so the drifting the whole thing
    // exists to cure never appears.
    diagram: {
      space: [30, 20],
      caption: "Drifting sideways",
      cones: [[0, 0], [30, 0], [0, 20], [30, 20], [5, 9], [12, 9], [19, 9], [26, 9]],
      attack: [[7, 15], [13, 15], [19, 15], [25, 15]],
      defence: [[10, 9], [16, 9], [22, 9]],
      runs: [
        [[8.4, 14.8], [11.9, 14]],
        [[14.4, 14.8], [17.9, 14]],
        [[20.4, 14.8], [23.9, 14]],
        [[26.4, 14.8], [29.4, 14]],
      ],
      ball: [[7, 13.8]],
      after: {
        space: [30, 20],
        caption: "Square up and move it",
        cones: [[0, 0], [30, 0], [0, 20], [30, 20], [5, 9], [12, 9], [19, 9], [26, 9]],
        attack: [[7, 15], [13, 15], [19, 15], [25, 15]],
        defence: [[10, 9], [16, 9], [22, 9]],
        runs: [
          [[7, 14], [7, 10.6]],
          [[13, 14], [13, 10.6]],
          [[19, 14], [19, 10.6]],
          [[25, 14], [25, 10.6]],
        ],
        passes: [
          [[8.4, 15], [11.6, 15]],
          [[14.4, 15], [17.6, 15]],
          [[20.4, 15], [23.6, 15]],
        ],
        ball: [[7, 13.8]],
      },
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "A line of four attackers against three defenders standing on a marked line.",
    howItRuns:
      "Attackers start drifting sideways. On your call they have to square up, run straight and then move the ball. Defenders can only move forward once the ball moves. Six goes then swap over. Drifting across the pitch is the most common thing minis do wrong and this makes it obvious why.",
    coachingPoints: [
      "Straighten up before you pass. Running sideways gives the defence time",
      "Fix your defender by running at them",
      "Ball moves quicker than feet. Do not run it to the touchline",
    ],
    progressions: ["Defenders may move as soon as the attack does"],
    regressions: ["Five attackers against three", "Defenders walk"],
    faults: [
      {
        looks: "The whole line drifting further towards the touchline every pass",
        say: "Turn your hips up the pitch before you pass",
      },
      {
        looks: "Carrying the ball sideways instead of moving it",
        say: "Ball travels faster than you. Move it",
      },
    ],
  },
  {
    id: "drill-blind-pass-drill",
    title: "Hands without looking",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u10",
    minutes: 8,
    players: { min: 6, max: 18 },
    space: "20 x 10 m",
    diagram: {
      space: [10, 20],
      cones: [[0, 0], [10, 0], [0, 20], [10, 20]],
      attack: [[2.5, 15], [5, 15], [7.5, 15]],
      runs: [
        [[2.5, 13.8], [2.5, 4.6]],
        [[5, 13.8], [5, 4.6]],
        [[7.5, 13.8], [7.5, 4.6]],
      ],
      passes: [
        [[3.4, 15], [4.1, 15]],
        [[5.9, 15], [6.6, 15]],
      ],
      ball: [[2.5, 13.6]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1 }],
    setup: "Threes in a line jogging up a channel. You stand off to one side.",
    howItRuns:
      "As the line jogs, you hold up a number of fingers. The carrier has to shout the number before passing on. It forces their eyes up off the ball. Four lengths each. They will drop a few at first, which is the point being made for you.",
    coachingPoints: [
      "Eyes up. Feel the pass, do not watch it",
      "Catch with your fingers not your palms",
      "Say the number loud enough that everyone hears it",
    ],
    progressions: ["Hold the number up on the far side so they have to properly look across"],
    regressions: ["Walk it", "Call the number out loud yourself as well"],
    faults: [
      {
        looks: "Eyes dropping to the ball at the moment of the pass",
        say: "Keep looking at me. You know where their hands are",
      },
      {
        looks: "Catching with stiff arms so the ball bounces out",
        say: "Soft hands. Let it come into you",
      },
    ],
  },
  {
    id: "drill-spin-pass-build",
    title: "Spin pass build",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u11",
    minutes: 9,
    players: { min: 6, max: 20 },
    space: "15 x 15 m",
    softGround: true,
    diagram: {
      label: "Set up diagram. Three pairs five metres apart, spin passing to each other.",
      space: [15, 15],
      attack: [[3, 5], [7.5, 5], [12, 5]],
      defence: [[3, 10], [7.5, 10], [12, 10]],
      passes: [
        [[3, 5.9], [3, 9.1]],
        [[7.5, 5.9], [7.5, 9.1]],
        [[12, 5.9], [12, 9.1]],
      ],
    },
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs, kneeling, five metres apart.",
    howItRuns:
      "From the knees, spin passes to each other. Twenty each side. Knees take the legs out of it so all they can do is use their hands. Then stand up, go to eight metres and do twenty more. Then jog and pass. A long pass is a wrist and a follow through, not a big heave. Kneeling proves that faster than any explanation.",
    coachingPoints: [
      "Bottom hand pushes, top hand guides the spin",
      "Follow through towards the target with both hands",
      "Ball comes off the fingers, not the palm",
    ],
    progressions: ["Stretch to twelve metres", "Pass off both hands equally"],
    regressions: ["Stay kneeling and closer", "No spin at all, just a firm push pass"],
    faults: [
      {
        looks: "Both hands shoving the ball, so it wobbles and goes nowhere",
        say: "Bottom hand does the work. Top hand only turns it",
      },
      {
        looks: "The pass stopping at the chest with no follow through",
        say: "Finish with both hands pointing at them",
      },
    ],
  },
  {
    id: "drill-two-on-one-continuous",
    title: "Two on one, no stopping",
    kind: "exercise",
    themes: ["handling", "gamesense"],
    minAge: "u11",
    minutes: 12,
    players: { min: 9, max: 21 },
    space: "40 x 20 m",
    diagram: {
      space: [20, 40],
      cones: [[0, 32], [20, 32], [0, 24], [20, 24], [0, 16], [20, 16], [0, 8], [20, 8]],
      attack: [[9, 36], [13, 36.8]],
      defence: [[10, 32], [9, 24], [11, 16], [10, 8]],
      runs: [[[10, 34.6], [10, 4], 3.5]],
      passes: [[[10.4, 36.2], [11.6, 36.4]]],
      ball: [[9, 34.6]],
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup:
      "Two attackers set off from one end. One defender comes out to meet them. Fresh defenders wait at each of four stations up the pitch.",
    howItRuns:
      "Beat the first defender, keep going, the next one comes out. Four in a row without stopping. Then jog to the back and the next pair go. Two goes each. Their decision making holds up fine when fresh and falls apart by the fourth defender, which is when a match actually gets decided.",
    coachingPoints: [
      "Fix the defender then pass. Do not pass early out of habit",
      "Support stays behind the ball and a bit wide",
      "Talk between yourselves. Silence means somebody guesses",
    ],
    progressions: ["Three attackers against two at each station", "Five stations"],
    regressions: ["Two stations", "Defenders may only move sideways"],
    faults: [
      {
        looks: "Passing before the defender has been made to choose",
        say: "Take it another two steps. Make them come to you",
      },
      {
        looks: "Support drifting level with the carrier so the pass goes forward",
        say: "Stay behind the ball. A bit deeper than you think",
      },
    ],
  },
  {
    id: "drill-scrum-half-clearing-pass",
    title: "Clearing pass off the floor",
    kind: "exercise",
    themes: ["handling"],
    minAge: "u11",
    minutes: 9,
    players: { min: 4, max: 16 },
    space: "20 x 15 m",
    diagram: {
      label:
        "Set up diagram. Two pairs. A ball on the ground with a passer beside it and a receiver eight metres away.",
      space: [20, 15],
      cones: [[0, 0], [20, 0], [0, 15], [20, 15]],
      attack: [[6, 5], [6, 11]],
      defence: [[14, 5], [14, 11]],
      passes: [
        [[7, 5], [13, 5]],
        [[7, 11], [13, 11]],
      ],
      ball: [[4.1, 6], [4.1, 12]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }],
    setup: "A ball on the ground. A passer beside it, a receiver eight metres away.",
    howItRuns:
      "Pick the ball up off the floor and pass it in one movement. No standing up first. Ten each side, then swap. Every child in the squad does this, not just whoever fancies themselves at nine, because on a Sunday somebody else will be doing it.",
    coachingPoints: [
      "Get your feet to the ball before your hands",
      "Sweep it away in one movement, do not lift then pass",
      "Point your back foot at the target",
    ],
    progressions: ["Ball is rolled to them so they arrive at it moving", "Pass off both sides"],
    regressions: ["Shorter pass", "Two movements allowed to start with"],
    faults: [
      {
        looks: "Standing up with the ball first, then passing",
        say: "One movement. Sweep it away from where it is",
      },
      {
        looks: "Feet planted too far from the ball so they have to stretch",
        say: "Get your feet to it. Step, then sweep",
      },
    ],
  },
];
