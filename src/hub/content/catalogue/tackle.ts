import type { Drill } from "../types.js";

/**
 * Tackling and ball presentation. U9 and up, per Regulation 15.
 *
 * Every one of these has a safety note and the test will not let you add one
 * without. Two rules run through the lot of them. Match children by size, never by
 * age alone. And stop the drill the moment a head goes in front of the carrier. Not
 * at the end of the rep. Now.
 */
export const TACKLE: Drill[] = [
  {
    id: "drill-cheek-to-cheek",
    title: "Cheek to cheek",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u9",
    minutes: 12,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs of similar size, both kneeling, facing each other a metre apart. Soft grass only.",
    howItRuns:
      "From the knees, the tackler puts their head to the side of the carrier's hip, wraps both arms round the legs, squeezes and they roll to the floor together. Ten each side from the knees before anybody stands up. Then from a crouch with the carrier walking. Only go to a jog once the head is in the right place every single time.",
    coachingPoints: [
      "Head on the side away from the knees. Never in front, never across",
      "Both arms wrap and grip. A tackle is a hug, not a shove",
      "Eyes open, looking at the target all the way in",
    ],
    progressions: [
      "Carrier walks, tackler starts from a crouch",
      "Carrier jogs a straight line, tackler comes from the side",
    ],
    regressions: ["Stay on the knees the whole session", "Wrap and hold without taking them down"],
    safety:
      "Match by size, never by age alone. Head position is the one thing that is not negotiable, so stop the drill instantly for any head in front of the carrier. Contact below the waist only. If anybody is tired enough to be dropping their technique, they stop.",
  },
  {
    id: "drill-long-placement",
    title: "Long placement",
    kind: "exercise",
    themes: ["tackle", "handling"],
    minAge: "u9",
    minutes: 10,
    players: { min: 6, max: 18 },
    space: "10 x 15 m",
    equipment: [
      { item: "cone", qty: 4 },
      { item: "ball", qty: 1, per: "pair" },
      { item: "tackle shield", qty: 1, per: "pair" },
    ],
    setup: "Pairs. One holds a shield at hip height, the other has the ball, three metres apart.",
    howItRuns:
      "Run into the shield, go down on your side and get both arms back towards your own team straight away. Hold it there for a count of one so everyone sees the shape, then get up. Five each then swap. Finish with somebody standing over the ball so there is a bit of pressure on.",
    coachingPoints: [
      "Land on your side so your arms are free",
      "Arms straight and long, ball back towards your own posts",
      "Up on your feet the second it is placed",
    ],
    progressions: ["A support player arrives to pick up and carry on"],
    regressions: ["Place from kneeling with no shield contact"],
    safety:
      "Shield holders brace and absorb, they never drive back into the carrier. Contact at hip height only. Check the ground first.",
  },
  {
    id: "drill-tackle-and-get-up",
    title: "Tackle and get up",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u9",
    minutes: 10,
    players: { min: 6, max: 18 },
    space: "10 x 10 m",
    equipment: [{ item: "ball", qty: 1, per: "pair" }, { item: "tackle shield", qty: 1, per: "pair" }],
    setup: "Pairs. One with a shield, one tackler starting on their knees.",
    howItRuns:
      "Tackle the shield, go to the floor with it, then get straight back to your feet facing up the pitch. Eight each. Half the value of a tackle is being back on your feet afterwards and children who have only practised the tackle itself lie on the floor admiring it.",
    coachingPoints: [
      "Head to the side, both arms wrapped",
      "Roll to your side then straight up. Do not push up off your front",
      "Get up facing the way the game is going",
    ],
    progressions: ["Start from a crouch instead of the knees", "Two shields, two tackles in a row"],
    regressions: ["Wrap and hold without going to ground"],
    safety:
      "Shield holders absorb only. Contact stays below the chest. Stop for any head going in front. Soft grass, checked first.",
  },
  {
    id: "drill-side-on-tackle",
    title: "Side on tackle",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u9",
    minutes: 11,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1, per: "pair" }],
    setup:
      "A five metre channel. Carrier walks across it. Tackler starts kneeling to the side, not in front.",
    howItRuns:
      "The carrier walks across, the tackler comes in from the side and takes them round the legs. Six each side then swap. Coming in from the side is safer and easier than head on, so it is the one worth learning first even though children always want to go front on.",
    coachingPoints: [
      "Track them. Move to where they will be, not where they are",
      "Head behind them, cheek to the backside",
      "Squeeze the legs together and let their own momentum do the rest",
    ],
    progressions: ["Carrier jogs instead of walking", "Tackler starts from a crouch"],
    regressions: ["Carrier walks slowly and in a straight line", "Tackler stays kneeling"],
    safety:
      "Side on only, never from directly in front in this one. Match by size. Below the waist. Stop instantly for a head going in front of the carrier.",
  },
  {
    id: "drill-front-on-tackle",
    title: "Front on tackle",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u10",
    minutes: 12,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    equipment: [{ item: "ball", qty: 1, per: "pair" }, { item: "tackle shield", qty: 1, per: "pair" }],
    setup: "Pairs of similar size, three metres apart. Shield first, then a walking carrier.",
    howItRuns:
      "Ten into the shield from a crouch, walking pace. Then ten against a walking carrier. Only progress to a jog when the head is going to the side every time without you saying it. This is the tackle that gets done badly most often, so it gets the slowest build.",
    coachingPoints: [
      "Head slips to the side of the hips at the last moment",
      "Get your shoulder in below their waist",
      "Drive with your legs after contact, do not stop on impact",
    ],
    progressions: ["Carrier jogs", "Carrier is allowed one side step"],
    regressions: ["Shield only", "From the knees"],
    safety:
      "The single most important note in the catalogue. Any head going in front of the carrier stops the drill immediately. Contact below the waist, nowhere near the chest or the head. Match by size, never by age. No jogging until every rep is technically right at walking pace.",
  },
  {
    id: "drill-two-tackle-shuttle",
    title: "Two tackle shuttle",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u10",
    minutes: 10,
    players: { min: 8, max: 20 },
    space: "15 x 10 m",
    equipment: [{ item: "tackle shield", qty: 2 }, { item: "cone", qty: 4 }],
    setup: "Two shield holders five metres apart. Tacklers queue at one side.",
    howItRuns:
      "Tackle the first shield, get up, tackle the second, get up. Four goes each with a proper rest between. Two in a row is where technique starts to go, so this is the drill where you find out whose tackle holds up when they are blowing a bit.",
    coachingPoints: [
      "Same technique on the second one as the first",
      "Get all the way to your feet before you go again",
      "If you are too tired to do it properly, say so",
    ],
    progressions: ["Three shields"],
    regressions: ["One shield with a walk back", "Wrap and hold without going down"],
    safety:
      "Tiredness is the risk here, so build in a real rest and cap it at four goes. Any drop in head position and that child is finished for the drill. Shield holders absorb, never drive.",
  },
  {
    id: "drill-tackle-then-compete",
    title: "Tackle then compete",
    kind: "exercise",
    themes: ["tackle", "breakdown"],
    minAge: "u10",
    minutes: 12,
    players: { min: 8, max: 18 },
    space: "15 x 15 m",
    equipment: [{ item: "ball", qty: 1, per: "pair" }, { item: "tackle shield", qty: 2 }],
    setup: "Fours. A carrier, a tackler and a support player each side.",
    howItRuns:
      "Carrier walks in, tackler takes them down, both get up and compete for the ball while their support arrives. Six goes then rotate everybody. The tackle is not the end of anything and this joins the two halves up so they stop treating them as separate.",
    coachingPoints: [
      "Tackler gets up first. Whoever stands up first usually wins the ball",
      "Carrier places long even though you know somebody is coming",
      "Support arrives low and stays on their feet",
    ],
    progressions: ["Carrier jogs in", "Two support players each side"],
    regressions: ["Walk everything", "Nobody competes, just get up and reset"],
    safety:
      "Age grade rules apply at the contest, so everybody stays on their feet and nobody joins from the side. Walking pace until the whole sequence is tidy. Stop for any head in front of the carrier.",
  },
  {
    id: "drill-defend-your-channel",
    title: "Defend your channel",
    kind: "exercise",
    themes: ["tackle", "gamesense"],
    minAge: "u10",
    minutes: 11,
    players: { min: 8, max: 20 },
    space: "20 x 20 m",
    equipment: [{ item: "cone", qty: 8 }, { item: "ball", qty: 1 }],
    setup: "Four narrow channels side by side. One attacker and one defender in each.",
    howItRuns:
      "Everybody goes at once, one on one in their own channel, jogging pace. Four goes then swap. Narrow channels mean the tackle happens rather than being run around, so every child gets four proper contacts in eleven minutes instead of one.",
    coachingPoints: [
      "Get square in front of them before you commit",
      "Short steps as they get close. Do not lunge",
      "Head to the side, arms wrap, legs drive",
    ],
    progressions: ["Wider channels so there is some footwork to deal with"],
    regressions: ["Walking pace", "Narrower channels still"],
    safety:
      "Match every pair by size before you start and keep the same pairs. Jogging pace only. Watch all four channels and if you cannot see all four, run two at a time instead.",
  },
  {
    id: "drill-double-tackle",
    title: "Double tackle",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u11",
    minutes: 11,
    players: { min: 9, max: 21 },
    space: "15 x 15 m",
    equipment: [{ item: "ball", qty: 1 }, { item: "tackle shield", qty: 2 }],
    setup: "Threes. One carrier, two tacklers starting two metres apart.",
    howItRuns:
      "Two tacklers take one carrier. One goes low round the legs, the other goes higher on the ball but still below the chest. They have to sort out between themselves who is doing which before the carrier arrives. Six goes then rotate.",
    coachingPoints: [
      "Call it early. Low or high, say it out loud",
      "Low tackler goes first, high one arrives a beat later",
      "High tackler still stays below the chest",
    ],
    progressions: ["Carrier jogs and may step"],
    regressions: ["Shield instead of a player", "Walking pace with the roles fixed"],
    safety:
      "Two tacklers on one child needs watching closely. Walking pace until the calling is reliable. The high tackler is on the ball and below the chest, never near the head or the neck. Stop it the moment two heads end up in the same place.",
  },
  {
    id: "drill-tackle-under-fatigue",
    title: "Tackle when tired",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u11",
    minutes: 10,
    players: { min: 8, max: 18 },
    space: "20 x 15 m",
    equipment: [{ item: "cone", qty: 6 }, { item: "tackle shield", qty: 2 }],
    setup: "A twenty metre run out and back, then two shields waiting.",
    howItRuns:
      "Run twenty metres out and back then make one tackle. Three goes each with a good rest between. The whole point is that they feel what a tired tackle is like in a session where you are watching, rather than in the last five minutes of a match where you are not close enough to stop it.",
    coachingPoints: [
      "Same head position tired as fresh. No exceptions",
      "If your legs have gone, drop into a lower stance rather than reaching",
      "Tell your coach when you are done. That is not weakness",
    ],
    progressions: ["Thirty metre run out"],
    regressions: ["Shorter run", "Wrap and hold with no takedown"],
    safety:
      "This drill deliberately creates the conditions where technique fails, so it needs the closest watching of any of them. One tackle per go, three goes only, real rest between. Any drop in head position ends it for that child. Do not run this at the end of a session.",
  },
  {
    id: "drill-tackle-the-offload",
    title: "Stop the offload",
    kind: "exercise",
    themes: ["tackle"],
    minAge: "u11",
    minutes: 10,
    players: { min: 8, max: 18 },
    space: "15 x 15 m",
    equipment: [{ item: "ball", qty: 1 }, { item: "tackle shield", qty: 1 }],
    setup: "A carrier with a support runner. Two defenders.",
    howItRuns:
      "One defender takes the legs, the other takes the ball and the arms so it cannot be popped away. Carrier is trying to offload. Six goes then rotate. It gives the tacklers a reason to wrap properly instead of just knocking somebody over.",
    coachingPoints: [
      "Low tackler stops the legs, that is all",
      "Second defender wraps the ball arm and squeezes it in",
      "Arrive together. A gap between you is a gap for the pass",
    ],
    progressions: ["Two support runners so there are two options to shut down"],
    regressions: ["Walking pace", "Carrier holds the ball in one hand to make it obvious"],
    safety:
      "Both defenders stay below the chest. No grabbing round the neck to stop an arm. Walking pace until the two of them arrive together reliably.",
  },
  {
    id: "drill-choke-and-hold",
    title: "Hold them up",
    kind: "exercise",
    themes: ["tackle", "breakdown"],
    minAge: "u12",
    minutes: 10,
    players: { min: 8, max: 18 },
    space: "15 x 15 m",
    equipment: [{ item: "ball", qty: 1 }],
    setup: "A carrier walking in. Two defenders whose job is to keep them standing.",
    howItRuns:
      "Instead of taking the carrier down, hold them up on their feet and stop the ball getting away. Wrap the ball and the body, keep them upright, count to five. Six goes then rotate. At U12 the maul is in the game and this is how a maul actually starts.",
    coachingPoints: [
      "Get the ball wrapped before you worry about the body",
      "Stay on your feet and keep them on theirs",
      "Both defenders bind onto each other, not just the carrier",
    ],
    progressions: ["Carrier has a support player trying to free the ball"],
    regressions: ["One defender wrapping the ball only", "Carrier stands still"],
    safety:
      "Nobody goes to ground, so if the carrier starts falling, let them go rather than twisting them. No more than three players involved, per the age grade rules. Nothing above the chest and nothing near the neck.",
  },
];
