import type { Drill } from "../types.js";

/**
 * Ruck and maul. U10 and up, per Regulation 15.
 *
 * At U10 and U11 the ball has to be available within five seconds or it goes the
 * other way and no more than three players can be in a maul. Those numbers shape
 * most of what is in here.
 */
export const BREAKDOWN: Drill[] = [
  {
    id: "drill-two-second-ruck",
    title: "Two second ruck",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 12,
    players: { min: 8, max: 18 },
    space: "15 x 15 m",
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 2 }, { item: "tackle shield", qty: 2 }],
    setup: "Fours. A carrier, a shield holder and two support players five metres behind the carrier.",
    howItRuns:
      "Carrier goes in, down, places long. The first support player steps over the ball and stays on their feet. The second picks it up and carries on. All inside two seconds of the carrier hitting the floor, because at this age grade slow ball is turned over ball. Count it out loud so they can hear the clock.",
    coachingPoints: [
      "First one in arrives low, steps over the ball, stays on their feet",
      "Shout as you arrive so the carrier knows help is there",
      "Second player picks up with two hands and goes. No dithering",
    ],
    progressions: [
      "One defender who can compete once the ball is down",
      "Support starts ten metres back so they have to work to get there",
    ],
    regressions: ["Walk it with no shield", "One support player and no clock"],
    safety:
      "Everybody stays on their feet. No diving in, nobody joining from the side. Stop it the moment somebody drops their head as they arrive.",
  },
  {
    id: "drill-step-over-and-stay",
    title: "Step over and stay",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 9,
    players: { min: 6, max: 18 },
    space: "10 x 10 m",
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs. One lies on their side with a ball placed long. The other stands two metres away.",
    howItRuns:
      "Walk in, step right over the ball, get low with a flat back and stay on your feet. Hold it for three seconds. Ten each then swap. Nobody is pushing anybody. All they are learning is where their feet go, which is the bit children get wrong and then get penalised for all season.",
    coachingPoints: [
      "Feet either side of the ball, never on top of it",
      "Flat back, head up, hands ready",
      "Stay on your feet. Going off them is a penalty",
    ],
    progressions: ["A second player arrives and tries to shift you"],
    regressions: ["Stand over the ball without getting low", "Walk in from one metre"],
    safety: "No contact between players in the basic version. Bodies and feet only.",
  },
  {
    id: "drill-clear-the-threat",
    title: "Clear the threat",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 11,
    players: { min: 8, max: 18 },
    space: "12 x 12 m",
    equipment: [{ item: "ball", qty: 1 }, { item: "tackle shield", qty: 1, per: "pair" }],
    setup: "A ball on the floor. A shield holder crouched over it. A clearer three metres back.",
    howItRuns:
      "Come in low, get your shoulder into the shield, bind on and move it back off the ball. Then a second player picks up. Eight each. Low beats big every time here and the smallest child in your squad will out-clear the biggest one if their body position is better, which is worth them finding out.",
    coachingPoints: [
      "Lower than them. Whoever is lower wins it",
      "Bind with both arms then move your feet",
      "Come through the shield, do not stop on it",
    ],
    progressions: ["Two shields to clear in a row", "Shield holder braces harder"],
    regressions: ["Shield holder stands upright", "Walk in from one metre"],
    safety:
      "Shoulder to the shield, head to the side, never leading with the head. Shield holders brace and absorb only. Match by size and stop it if anybody starts launching themselves in.",
  },
  {
    id: "drill-five-second-count",
    title: "Five second count",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 10,
    players: { min: 9, max: 21 },
    space: "20 x 15 m",
    equipment: [{ item: "ball", qty: 1 }, { item: "tackle shield", qty: 2 }],
    setup: "A carrier, two support players and a scrum half who will clear the ball.",
    howItRuns:
      "Carrier goes down, everybody does their job and the ball has to be away inside five seconds with you counting it out loud. Fail it and they go again. Six goes. This is the actual rule at U10 and U11, so making them live with the count in training means the referee never surprises them.",
    coachingPoints: [
      "Count it out loud together. The whole team should know the clock",
      "Nine gets to the ball before it is available, not after",
      "Only put in as many players as you need",
    ],
    progressions: ["Four seconds", "A defender competing"],
    regressions: ["Seven seconds", "No defender and no shield"],
    safety:
      "Age grade rules exactly. Everybody on their feet, nobody in from the side. Counting creates a rush so watch for heads dropping as they hurry.",
  },
  {
    id: "drill-who-goes-in",
    title: "Who goes in",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u10",
    minutes: 11,
    players: { min: 10, max: 21 },
    space: "25 x 20 m",
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "Five attackers, two defenders, playing live contact under age grade rules.",
    howItRuns:
      "Carrier goes to ground. Only two attackers are allowed to go to the ruck. The other two have to stay out and be ready for the next phase. Six goes. Children want to pile in because it feels helpful. This teaches them that a ruck with four bodies in it and nobody outside is a wasted phase.",
    coachingPoints: [
      "Two in, no more. Whoever is closest",
      "Everybody else gets into position for the next one",
      "Call it. Say mine or say out",
    ],
    progressions: ["One attacker only allowed in", "Three defenders"],
    regressions: ["Three allowed in", "Touch instead of contact for the tackle"],
    safety:
      "Age grade contact rules. Nobody off their feet, nobody joining from the side. Keep numbers at the ruck low, which this drill does anyway.",
  },
  {
    id: "drill-pick-and-go",
    title: "Pick and go",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 9,
    players: { min: 6, max: 18 },
    space: "20 x 10 m",
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "A line of players a metre apart up a narrow channel. Ball on the floor at the start.",
    howItRuns:
      "First player picks up, drives one metre, goes down and places. Next player picks up and does the same. Work the whole line up the channel. Two lengths. It gets the pick up and the placement joined together so many times over that it stops being something they have to think about.",
    coachingPoints: [
      "Two hands on the pick up, get low before you lift",
      "Ball tucked into your chest before you go anywhere",
      "Place it long the moment you are down",
    ],
    progressions: ["Two metre drives", "A defender walking alongside applying pressure"],
    regressions: ["Walk it", "Place from a kneel"],
    safety: "No contact between players in the basic version. Ground contact only, checked pitch.",
  },
  {
    id: "drill-counter-ruck",
    title: "Counter ruck",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u11",
    minutes: 11,
    players: { min: 8, max: 18 },
    space: "15 x 15 m",
    equipment: [{ item: "ball", qty: 1 }, { item: "tackle shield", qty: 2 }],
    setup: "A ball on the floor with one attacker over it. Two defenders three metres away.",
    howItRuns:
      "The two defenders arrive together, bind onto each other and try to move the attacker off the ball. Six goes then swap. Two people arriving as one is the whole trick and it takes a while, so keep it at walking pace for longer than feels necessary.",
    coachingPoints: [
      "Bind onto each other before you get there",
      "Arrive at the same moment. A gap between you and it fails",
      "Lower than the player you are shifting",
    ],
    progressions: ["Three defenders against two attackers"],
    regressions: ["One defender", "Attacker stands upright and offers no resistance"],
    safety:
      "Walking pace until the two arrive as one. Everybody on their feet, shoulders and arms only, no heads leading. Match by size across the whole group.",
  },
  {
    id: "drill-maul-three-and-move",
    title: "Three man maul",
    kind: "exercise",
    themes: ["breakdown"],
    minAge: "u11",
    minutes: 10,
    players: { min: 6, max: 18 },
    space: "15 x 10 m",
    equipment: [{ item: "ball", qty: 1 }],
    setup: "A carrier held up by one opponent. One team mate ready to bind on.",
    howItRuns:
      "The carrier gets held, the team mate binds onto them and that is a maul. Three players, no more. Get the ball to the back and away inside five seconds. Six goes. At this age grade the maul is exactly three bodies, so learn it as three rather than learning it wrong and unlearning it later.",
    coachingPoints: [
      "Bind onto your own player properly before anything else",
      "Ball goes to the back straight away, do not hold it at the front",
      "Five seconds. Get it out or you lose it",
    ],
    progressions: ["Move the maul forward two metres before releasing"],
    regressions: ["Static, no movement at all", "Carrier is held loosely"],
    safety:
      "Three players maximum, which is the rule at this grade. Nobody drags anybody to ground. If the carrier goes down it is a ruck and everybody stays on their feet. Nothing above the chest.",
  },
  {
    id: "drill-ruck-to-ruck",
    title: "Ruck to ruck",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u11",
    minutes: 12,
    players: { min: 12, max: 24 },
    space: "30 x 25 m",
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Two teams playing live contact. Three defenders only so the attack usually gets through.",
    howItRuns:
      "Four rucks in a row without losing the ball. Reset if you drop it. Then swap over. It is about the bit between rucks rather than the rucks themselves, which is where most minis lose the ball on a Sunday.",
    coachingPoints: [
      "Look for the next ruck while this one is still happening",
      "Do not carry into the same place twice",
      "Somebody on their feet and calling before the ball comes out",
    ],
    progressions: ["Six rucks", "Four defenders"],
    regressions: ["Two rucks", "Two defenders"],
    safety:
      "Age grade contact rules throughout. Everybody on their feet at the ruck, nobody in from the side. Cap the reps and watch for tiredness rather than running it until somebody gets hurt.",
  },
  {
    id: "drill-defend-the-ruck-edge",
    title: "Guard the edge",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u11",
    minutes: 10,
    players: { min: 10, max: 21 },
    space: "25 x 20 m",
    equipment: [{ item: "cone", qty: 6 }, { item: "ball", qty: 1 }],
    setup: "A ruck already formed. Two defenders either side of it as guards, three more spread wide.",
    howItRuns:
      "The attack comes off the ruck either side. The two guards have to hold the space right next to it while the others cover the width. Six goes each side. The metre next to the ruck is where minis leak most of their tries and it is nobody's job until you make it somebody's.",
    coachingPoints: [
      "Guards stay square and close. Do not drift off the ruck",
      "One guard each side and say which side you have got",
      "Everybody else works out from the guards, not in from the touchline",
    ],
    progressions: ["One guard each side instead of two"],
    regressions: ["Three guards", "Attack must go wide only"],
    safety:
      "Age grade contact rules. Guards are defending a space, not launching at anybody. Below the chest, heads to the side.",
  },
  {
    id: "drill-carry-into-space",
    title: "Carry into space",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u12",
    minutes: 10,
    players: { min: 10, max: 21 },
    space: "30 x 25 m",
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Live contact, four attackers against three defenders. Two channels marked either side of the ruck.",
    howItRuns:
      "The next carrier has to take the ball into a marked channel rather than straight back into the defenders. Six goes. Children carry into the biggest body they can find because it feels brave. This makes the point that a carry is meant to gain ground.",
    coachingPoints: [
      "Pick your channel before you get the ball",
      "Run at a gap or a shoulder, never at a chest",
      "If there is nothing there, pass instead of carrying",
    ],
    progressions: ["Narrower channels", "Four defenders"],
    regressions: ["Wider channels", "Touch instead of contact"],
    safety:
      "Age grade contact rules. Everybody on their feet at the ruck. Watch for anybody dropping their head as they pick a gap late.",
  },
  {
    id: "drill-lazy-ruck-punish",
    title: "Slow ball, quick ball",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u12",
    minutes: 11,
    players: { min: 12, max: 24 },
    space: "35 x 25 m",
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Two teams. You referee and count every ruck out loud.",
    howItRuns:
      "Ball away inside three seconds and the attack gets a free play with the defence held back. Slower than three and the defence gets a free advance of five metres. Five minute halves. They will hear the difference between quick ball and slow ball in about ninety seconds.",
    coachingPoints: [
      "Quick ball comes from the placement, not from the scrum half",
      "Arrive before the tackle is finished, not after",
      "Defence, hold your shape while it is slow. The reward comes to you",
    ],
    progressions: ["Two seconds", "Bigger reward for the defence"],
    regressions: ["Four seconds", "Touch rules with a simulated ruck"],
    safety:
      "The clock creates urgency so watch body positions closely as they hurry in. Age grade rules on everything. Stop for anybody going off their feet.",
  },
  {
    id: "drill-turnover-to-try",
    title: "Turnover to try",
    kind: "exercise",
    themes: ["breakdown", "gamesense"],
    minAge: "u12",
    minutes: 11,
    players: { min: 12, max: 24 },
    space: "40 x 30 m",
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Two teams playing live. Defence is trying to win the ball at the ruck.",
    howItRuns:
      "Win the ball at a ruck and you have ten seconds to score before the whistle goes. Nothing else counts. Six goes each way. Winning a turnover feels like the achievement, so this makes clear that the turnover is worthless unless somebody has already looked up.",
    coachingPoints: [
      "Whoever wins it goes forward immediately. Do not set up",
      "Somebody has to be looking up before the ball is won",
      "The space is behind their ruck. Go there",
    ],
    progressions: ["Seven seconds", "Fewer attackers once the turnover happens"],
    regressions: ["Fifteen seconds", "Coach calls the turnover rather than contesting for it"],
    safety:
      "Contesting at the ruck under age grade rules only. On your feet, through the gate, hands or feet but never a shoulder into a bent-over player. Stop it if the competition gets scrappy.",
  },
];
