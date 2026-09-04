import type { Drill } from "../types.js";

/**
 * Warm-ups, every age grade. See docs/content-sourcing.md before adding one.
 *
 * The order players meet these matters. Something to do the second they arrive so
 * latecomers can join without stopping anything, then movement prep, then whatever
 * gets them ready for the contact you have planned.
 */
export const WARMUPS: Drill[] = [
  // ---- Arrival games, any age ----
  {
    id: "warmup-tail-snatch",
    title: "Tail snatch",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u7",
    minutes: 6,
    players: { min: 6, max: 24 },
    space: "20 x 20 m",
    diagram: {
      label:
        "Set up diagram. Eight players loose in a square, every one of them wearing two tags. Three of them are closing in on somebody.",
      space: [20, 20],
      cones: [[0, 0], [10, 0], [20, 0], [0, 10], [20, 10], [0, 20], [10, 20], [20, 20]],
      defence: [[4, 6], [16, 4.5], [8.5, 12], [17, 13], [5, 17.5]],
      attack: [[6.5, 9.5], [13.5, 8], [10.5, 16]],
      runs: [[[5.9, 8.7], [4.9, 7.2]], [[14.1, 7.2], [15.1, 5.7]], [[10.1, 15.1], [9.2, 13.3]]],
    },
    equipment: [{ item: "cone", qty: 8 }, { item: "tag", qty: 2, per: "player" }],
    setup:
      "Four cones in a square. Every player wears two tags. No balls for the first round.",
    howItRuns:
      "On go, everyone tries to take somebody else's tag while keeping their own. Dropped tags stay where they fall. Lose both of yours and you do five squats then rejoin. Ninety seconds, reset the tags, go again. Nobody stands still in this one, which is the whole point of putting it first.",
    coachingPoints: [
      "Small steps close to someone, long steps when you have space",
      "Turn your hips away from the hand reaching for you",
      "Eyes up. The ones who get caught are watching their own tags",
    ],
    progressions: [
      "Shrink the square by a metre every thirty seconds",
      "Two hunters with no tags of their own against everyone else",
    ],
    regressions: ["Bigger square", "One tag each instead of two"],
    faults: [
      {
        looks: "Long strides right up to the person they are chasing",
        say: "Chop your steps down as you get close",
      },
      {
        looks: "Eyes on their own tags instead of up",
        say: "Head up. Watch where you are going, not your waist",
      },
    ],
  },
  {
    id: "warmup-two-ball-square",
    title: "Two ball square",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u7",
    minutes: 6,
    players: { min: 8, max: 20 },
    space: "15 x 15 m",
    diagram: {
      space: [15, 15],
      cones: [[0, 0], [15, 0], [0, 15], [15, 15]],
      defence: [[6.5, 13.5], [4.5, 8], [8.5, 7], [13, 9], [6, 4], [11.5, 3.5]],
      attack: [[3.5, 11.5], [11.5, 12]],
      passes: [[[4.2, 10.9], [7.5, 7.9]], [[11.5, 11.1], [11.5, 4.9]]],
      ball: [[2.3, 12.6], [12.7, 13]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }],
    setup: "Players spread inside a square. Two balls, given to players standing well apart.",
    howItRuns:
      "Jog around and pass to anyone with two hands. Ball must not touch the floor. You cannot pass it back to whoever gave it to you. Count the passes before a drop then try to beat the number. Late arrivals just walk in.",
    coachingPoints: [
      "Call for it before you want it, not as it arrives",
      "Hands up and ready whenever you are moving",
      "Pass in front of them so they run onto it",
    ],
    progressions: ["Add a third ball", "Move to a different part of the square after every pass"],
    regressions: ["Walk instead of jog", "One ball only"],
    faults: [
      {
        looks: "Calling for it as it arrives, which is too late",
        say: "Shout before you want it, not when you need it",
      },
      {
        looks: "Passing at where they are standing rather than where they are going",
        say: "Pass in front. Make them run onto it",
      },
    ],
  },
  {
    id: "warmup-name-and-pass",
    title: "Name and pass",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u7",
    minutes: 5,
    players: { min: 8, max: 20 },
    space: "12 x 12 m",
    diagram: {
      space: [12, 12],
      defence: [[6, 1.5], [9.2, 2.8], [10.5, 6], [9.2, 9.2], [2.8, 9.2], [1.5, 6], [2.8, 2.8]],
      attack: [[6, 10.5]],
      passes: [[[6.3, 9.6], [8.8, 3.7]]],
      ball: [[4.5, 11.2]],
    },
    equipment: [{ item: "ball", qty: 1 }],
    setup: "Everyone in a loose circle, one ball.",
    howItRuns:
      "Shout a name then pass to them. They shout a different name then pass on. Nobody gets it twice until everyone has had it once. Two minutes of that then start jogging on the spot while you do it. Worth five minutes in September when half of them do not know each other yet.",
    coachingPoints: [
      "Say the name before the ball leaves your hands",
      "Look at the person you are passing to",
      "Two hands on the ball every time",
    ],
    progressions: ["Add a second ball going the other way", "Jog around the circle while passing"],
    regressions: ["Underarm pass only", "Smaller circle"],
    faults: [
      {
        looks: "Name said as the ball is already in the air",
        say: "Say it first, then pass. In that order",
      },
    ],
  },
  {
    id: "warmup-traffic-lights",
    title: "Traffic lights",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u7",
    minutes: 5,
    players: { min: 6 },
    space: "20 x 20 m",
    diagram: {
      space: [20, 20],
      cones: [[0, 0], [20, 0], [0, 20], [20, 20]],
      defence: [[4, 15], [9, 17], [15, 14], [6, 8], [12, 9], [17, 5]],
      runs: [
        [[4, 14], [5, 7], 1.2],
        [[9, 16], [10.5, 12.5], -1],
        [[15, 13], [15.5, 11]],
        [[12, 8], [12.8, 6]],
      ],
    },
    equipment: [{ item: "cone", qty: 4 }],
    setup: "A square. Everyone inside it, jogging.",
    howItRuns:
      "Green means jog, amber means walk, red means freeze. Then add your own calls. Down means on the floor and up again, turn means change direction, sprint means five hard steps. Build the calls up so by the end they are reacting without thinking. Good for a cold morning because it gets warm quickly and needs no kit.",
    coachingPoints: [
      "Freeze means still. Wobbling is not still",
      "Land soft on the change of direction, do not skid",
      "Head up so you do not run into each other",
    ],
    progressions: ["Say one colour and mean another so they have to listen", "Everyone carries a ball"],
    regressions: ["Three calls only", "Walk everything"],
    faults: [
      {
        looks: "Freezing with a bit of a wobble and a shuffle",
        say: "Still means still. Hold it until I say",
      },
      {
        looks: "Skidding into the turn on straight legs",
        say: "Bend your knees. Land quiet",
      },
    ],
  },
  {
    id: "warmup-shark-in-the-pond",
    title: "Shark in the pond",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u7",
    minutes: 6,
    players: { min: 8, max: 24 },
    space: "20 x 15 m",
    diagram: {
      label:
        "Set up diagram. A channel with a safe zone marked at each end. Six runners set off from the near zone while two sharks wait in the middle.",
      space: [15, 20],
      cones: [[1, 16], [7.5, 16], [14, 16], [1, 4], [7.5, 4], [14, 4]],
      defence: [[5.5, 10], [10, 10.5]],
      attack: [[2, 18.2], [5, 18.8], [8, 18.2], [11, 18.8], [14, 18.2], [9.5, 16.8]],
      runs: [[[2, 17.2], [3, 3.2], 1.5], [[14, 17.2], [12.5, 3.2], -1.5]],
    },
    equipment: [{ item: "cone", qty: 6 }, { item: "tag", qty: 2, per: "player" }],
    setup: "A channel with a safe zone at each end. Two sharks in the middle, everyone else at one end.",
    howItRuns:
      "On the call, everyone runs from one safe zone to the other. Sharks take tags. Lose a tag and you become a shark. Keep going until there are two runners left. Takes about six minutes and every child is running the whole time.",
    coachingPoints: [
      "Pick your gap before you set off",
      "Go when it opens. Waiting makes it worse",
      "Sharks work together, do not both chase the same runner",
    ],
    progressions: ["Narrow the channel", "Runners carry a ball in two hands"],
    regressions: ["Wider channel", "One shark to start"],
    faults: [
      {
        looks: "Standing on the line waiting for a perfect gap",
        say: "Go. A gap now beats a better one never",
      },
      {
        looks: "Both sharks chasing the same runner",
        say: "One each. Talk to each other",
      },
    ],
  },
  {
    id: "warmup-follow-the-leader",
    title: "Follow the leader",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u7",
    minutes: 5,
    players: { min: 6 },
    space: "20 x 20 m",
    diagram: {
      label:
        "Set up diagram. Three pairs spread round a square, each follower a step behind their leader on a winding path.",
      space: [20, 20],
      cones: [[0, 0], [20, 0], [0, 20], [20, 20]],
      defence: [[3.4, 11.6], [11.6, 6.9], [7.6, 17.9]],
      attack: [[4, 10], [13, 6], [9, 17]],
      runs: [[[4, 9], [6, 3.5], 2], [[13, 5], [17, 2.5], -1.5], [[9, 16], [15, 12], 2.5]],
    },
    equipment: [{ item: "cone", qty: 4 }],
    setup: "Pairs, one behind the other, spread around a square.",
    howItRuns:
      "The front one jogs wherever they like and changes direction when they feel like it. The one behind copies, staying within touching distance. Swap after a minute. Do three each. They are learning to watch hips without anybody having to say the word.",
    coachingPoints: [
      "Leaders, change direction properly. A slow curve is not a change",
      "Followers, watch their hips not their feet",
      "Stay close enough to touch them",
    ],
    progressions: ["Leader carries a ball", "Follower has to mirror rather than copy"],
    regressions: ["Walk it", "Leader changes direction on your call only"],
    faults: [
      {
        looks: "Leaders running long slow curves that are easy to follow",
        say: "Sharp changes. Make it hard for them",
      },
      {
        looks: "Followers drifting five metres back",
        say: "Close enough to touch them",
      },
    ],
  },
  {
    id: "warmup-rob-the-nest",
    title: "Rob the nest",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u7",
    minutes: 6,
    players: { min: 8, max: 24 },
    space: "25 x 25 m",
    diagram: {
      label:
        "Set up diagram. Four nests of three cones, one in each corner, with all eight balls piled in the middle. One runner from each team is on the way in.",
      space: [25, 25],
      cones: [
        [0.8, 3],
        [2.1, 2.1],
        [3, 0.8],
        [24.2, 3],
        [22.9, 2.1],
        [22, 0.8],
        [0.8, 22],
        [2.1, 22.9],
        [3, 24.2],
        [24.2, 22],
        [22.9, 22.9],
        [22, 24.2],
      ],
      defence: [[3.5, 3.5], [21.5, 3.5], [3.5, 21.5], [21.5, 21.5]],
      attack: [[5.5, 6], [19.5, 6], [5.5, 19], [19.5, 19]],
      runs: [
        [[6.5, 6.9], [9.5, 9.7]],
        [[18.5, 6.9], [15.5, 9.7]],
        [[6.5, 18.1], [9.5, 15.3]],
        [[18.5, 18.1], [15.5, 15.3]],
      ],
      ball: [
        [10.6, 11.2],
        [12.5, 11.2],
        [14.4, 11.2],
        [10.6, 12.6],
        [12.5, 12.6],
        [14.4, 12.6],
        [11.5, 14],
        [13.5, 14],
      ],
    },
    equipment: [{ item: "cone", qty: 12 }, { item: "ball", qty: 8 }],
    setup:
      "Four teams, one in each corner with a hoop of cones for a nest. All the balls in a pile in the middle.",
    howItRuns:
      "One player at a time fetches a ball from the middle and puts it in their nest. When the middle is empty you can take from other nests. One ball at a time, always carried in two hands. Two minutes then count. They will keep asking for it, which is fine because they are sprinting for six minutes and think they are playing.",
    coachingPoints: [
      "Two hands on the ball the whole way back",
      "Place it in the nest, do not throw it",
      "Look before you run so you know where you are going",
    ],
    progressions: ["Balls must be placed on the ground with two hands and a bend of the knees"],
    regressions: ["Nests closer to the middle", "More balls so nobody waits"],
    faults: [
      {
        looks: "The ball thrown into the nest from a stride away",
        say: "Place it. Bend down and put it in",
      },
      {
        looks: "Setting off before they have picked which nest",
        say: "Look first, then run",
      },
    ],
  },
  {
    id: "warmup-four-corner-passing",
    title: "Four corner passing",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u8",
    minutes: 7,
    players: { min: 8, max: 20 },
    space: "15 x 15 m",
    diagram: {
      space: [15, 15],
      cones: [[0, 0], [15, 0], [0, 15], [15, 15]],
      defence: [
        [2, 1.5],
        [2, 3.2],
        [13, 1.5],
        [13, 3.2],
        [2, 13.5],
        [2, 11.8],
        [13, 13.5],
        [13, 11.8],
      ],
      attack: [[5.5, 9.5], [9.5, 5.5]],
      runs: [[[5, 8.5], [3.1, 4.7], 2], [[10, 6.5], [11.9, 10.3], 2]],
      passes: [[[5, 8.6], [2.7, 4.4]], [[10, 6.4], [12.3, 10.6]]],
      ball: [[7, 10.2], [8, 4.8]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 2 }],
    setup: "A group at each corner of a square. Balls at two opposite corners.",
    howItRuns:
      "Run across the square, pass to the group on your left, join the back of that group. Two balls going at once so there is always something happening. Ninety seconds one way then turn it round and pass right. They will all be worse at that which is worth them finding out.",
    coachingPoints: [
      "Pass across your body, do not swing your arms round",
      "Receiver runs onto the ball, do not stand and wait for it",
      "Look at the target before the ball leaves your hands",
    ],
    progressions: ["Three balls", "Pass then sprint to the far corner instead of the near one"],
    regressions: ["One ball", "Walk the first minute"],
    faults: [
      {
        looks: "Arms swinging round the body so the pass loops",
        say: "Push it across your chest. Do not wind up",
      },
      {
        looks: "Standing still waiting for the ball to arrive",
        say: "Run onto it. Keep moving",
      },
    ],
  },

  // ---- Movement prep ----
  {
    id: "warmup-move-and-brace",
    title: "Move and brace",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u9",
    minutes: 8,
    players: { min: 6 },
    space: "20 m channel",
    diagram: {
      label:
        "Set up diagram. Two lines of cones ten metres apart. A wave of four works up the channel while the next wave waits behind.",
      space: [12, 20],
      cones: [[2, 15], [6, 15], [10, 15], [2, 5], [6, 5], [10, 5]],
      defence: [[1.5, 17.5], [4.5, 17.5], [7.5, 17.5], [10.5, 17.5]],
      attack: [[1.5, 13.2], [4.5, 13.2], [7.5, 13.2], [10.5, 13.2]],
      runs: [
        [[1.5, 12.2], [1.5, 6.4]],
        [[4.5, 12.2], [4.5, 6.4]],
        [[7.5, 12.2], [7.5, 6.4]],
        [[10.5, 12.2], [10.5, 6.4]],
      ],
    },
    equipment: [{ item: "cone", qty: 6 }],
    setup: "Two lines of cones ten metres apart. Work in waves of four or five so nobody queues.",
    howItRuns:
      "One length each, jog back to rejoin. High knees. Heel flicks. Side steps facing left then facing right. Then a jog with a hard stop and a two-footed brace on your call. Finish with two builds up to about three quarter pace. This is the bit everyone skips when they are running late. It is also the bit that keeps ankles and knees in one piece.",
    coachingPoints: [
      "On the brace, feet shoulder width apart, knees bent, chest up",
      "Land softly. You should not hear it",
      "Build the pace across the sequence, do not sprint the first one",
    ],
    progressions: ["Add a change of direction on the call before the brace"],
    regressions: ["Shorter channel", "Drop the builds if it is really cold"],
    safety:
      "This comes before any contact, every session. The research on structured rugby warm-ups is that they cut soft tissue injuries and concussions by a long way. It takes eight minutes.",
    faults: [
      {
        looks: "Straight legs and a rounded back on the brace",
        say: "Bend your knees. Chest up, look at me",
      },
      {
        looks: "Sprinting the first one and having nothing left",
        say: "Build it. First one is a jog",
      },
    ],
  },
  {
    id: "warmup-ankles-and-knees",
    title: "Ankles and knees",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u9",
    minutes: 6,
    players: { min: 4 },
    space: "10 x 10 m",
    equipment: [],
    setup: "Everyone with a bit of space around them. No kit needed.",
    howItRuns:
      "Ten calf raises. Ten slow squats, chest up. Ten walking lunges each leg. Then balance on one leg for fifteen seconds a side. Once that is easy do it with your eyes shut. Boring to look at and it is the reason a nine year old lands a jump properly in February.",
    coachingPoints: [
      "Knees track over your toes, not falling inwards",
      "Slow down. Fast reps do nothing here",
      "Chest up on the squat, weight through the middle of your foot",
    ],
    progressions: ["Eyes shut on the balance", "Single leg calf raises"],
    regressions: ["Hold a partner for the balance", "Half depth on the squat"],
    safety:
      "Nobody is loading up here, so if a child says something hurts believe them and move them on to something else.",
    faults: [
      {
        looks: "Knees falling inwards on the squat",
        say: "Push your knees out over your toes",
      },
      {
        looks: "Rushing through the reps to be finished",
        say: "Slow. Fast does nothing here",
      },
    ],
  },
  {
    id: "warmup-partner-mirror",
    title: "Partner mirror",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u9",
    minutes: 5,
    players: { min: 6 },
    space: "10 x 10 m",
    diagram: {
      label:
        "Set up diagram. Two pairs two metres apart, each one staying square as their partner steps sideways.",
      space: [10, 10],
      cones: [[0, 0], [10, 0], [0, 10], [10, 10]],
      defence: [[2.5, 5], [7, 5]],
      attack: [[2.5, 7], [7, 7]],
      runs: [
        [[3.4, 7], [4.9, 7]],
        [[3.4, 5], [4.9, 5]],
        [[7.9, 7], [9.4, 7]],
        [[7.9, 5], [9.4, 5]],
      ],
    },
    equipment: [{ item: "cone", qty: 4 }],
    setup: "Pairs facing each other, two metres apart, in a small grid.",
    howItRuns:
      "One leads, side stepping and shuffling within their two metres. The other stays square in front of them the whole time. Thirty seconds then swap. Three each. This is what defending actually looks like before anybody touches anybody.",
    coachingPoints: [
      "Stay square. Do not cross your feet over",
      "Short steps, weight on the balls of your feet",
      "Watch their belly button, not their shoulders",
    ],
    progressions: ["Leader holds a ball and can step past on your call"],
    regressions: ["Walk it", "One metre apart so there is less to cover"],
    faults: [
      {
        looks: "Feet crossing over and the balance going",
        say: "Shuffle. Never cross them",
      },
      {
        looks: "Watching the shoulders and getting sold every time",
        say: "Watch their belly button. It cannot lie",
      },
    ],
  },
  {
    id: "warmup-down-and-up",
    title: "Down and up",
    kind: "warmup",
    themes: ["tackle"],
    minAge: "u9",
    minutes: 6,
    players: { min: 6 },
    space: "10 x 10 m",
    softGround: true,
    diagram: {
      label:
        "Set up diagram. A loose group of six in a small square. One of them holds the ball and places it back towards the coach.",
      space: [10, 10],
      cones: [[0, 0], [10, 0], [0, 10], [10, 10]],
      defence: [[6.5, 3.5], [9, 6], [2, 7.5], [5.5, 8], [8.5, 9]],
      attack: [[3, 4.5]],
      passes: [[[3, 5.3], [3, 6.9]]],
      ball: [[1.5, 4.3]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1 }],
    setup: "A loose group inside a small square. Grass only, never a hard surface.",
    howItRuns:
      "Jog on the spot. On down they go to ground on their side with the chin tucked, then roll once. On up they get back to their feet facing you. Eight to ten of those. Then do it holding a ball and place it back towards you every time they go down. Getting up off the floor quickly is half of rugby and almost nobody practises it.",
    coachingPoints: [
      "Land on your side. Never flat on your front or your back",
      "Chin tucked to your chest the whole way down",
      "Get up facing the way you were going, not the way you fell",
    ],
    progressions: ["A partner gives a light shove on the shoulder before the call"],
    regressions: ["Start from kneeling rather than standing"],
    safety:
      "Ground contact only. Nobody touches anybody. Walk the pitch for stones and dog mess first. Stop if the ground is frozen.",
    faults: [
      {
        looks: "Landing flat on the front or straight onto the back",
        say: "On your side. Show me which side before you go",
      },
      {
        looks: "The head thrown back on the way down",
        say: "Chin on your chest. Tuck it in",
      },
    ],
  },
  {
    id: "warmup-shoulder-to-shield",
    title: "Shoulder to shield",
    kind: "warmup",
    themes: ["tackle"],
    minAge: "u9",
    minutes: 7,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    softGround: true,
    diagram: {
      label:
        "Set up diagram. Two pairs, a shield held low in each. The other player goes in from their knees.",
      space: [10, 10],
      shields: [[3, 4], [7, 4]],
      attack: [[3, 6.2], [7, 6.2]],
      runs: [[[3, 5.6], [3, 4.5]], [[7, 5.6], [7, 4.5]]],
    },
    equipment: [{ item: "tackle shield", qty: 1, per: "pair" }],
    setup: "Pairs of similar size. One holds a shield low, the other kneels in front of it.",
    howItRuns:
      "From the knees, put your shoulder into the shield and wrap both arms round it. Squeeze, hold for a second, let go. Ten each. Then stand up and do it from a crouch, walking in. Never faster than a walk here. This is the shape you want burnt in before anyone runs at anything.",
    coachingPoints: [
      "Head to the side of the shield, never into it",
      "Eyes open and looking at the target",
      "Both arms wrap and grip. A shove is not a tackle",
    ],
    progressions: ["Shield holder takes one step forward as you go in"],
    regressions: ["Stay on the knees for the whole thing"],
    safety:
      "Match by size, not by age. Shield holders brace and absorb, they never drive back. Contact stays below the chest. Stop the moment technique starts falling apart from tiredness.",
    faults: [
      {
        looks: "The head going into the shield rather than past it",
        say: "Head to the side. Ear to the shield, never the crown",
      },
      {
        looks: "Arms shoving instead of wrapping",
        say: "Wrap and grip. It is a hug",
      },
    ],
  },
  {
    id: "warmup-jog-and-place",
    title: "Jog and place",
    kind: "warmup",
    themes: ["tackle", "handling"],
    minAge: "u9",
    minutes: 6,
    players: { min: 6 },
    space: "15 m channel",
    softGround: true,
    diagram: {
      space: [12, 15],
      cones: [[0, 0], [12, 0], [0, 15], [12, 15]],
      attack: [[1.5, 12], [4.5, 12], [7.5, 12], [10.5, 12]],
      runs: [
        [[0.4, 11], [0.4, 7.4]],
        [[3.4, 11], [3.4, 7.4]],
        [[6.4, 11], [6.4, 7.4]],
        [[9.4, 11], [9.4, 7.4]],
      ],
      ball: [[1.5, 8.2], [4.5, 8.2], [7.5, 8.2], [10.5, 8.2]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1, per: "pair" }],
    setup: "Waves of four, ball each, jogging up a short channel.",
    howItRuns:
      "Jog five metres, go down on your side, place the ball long behind you, get up and jog back. Six each. Slow and tidy, no rush. Placement is the skill that decides whether the next ruck is easy or horrible and it costs nothing to warm it up.",
    coachingPoints: [
      "Land on your side so your arms are free",
      "Arms straight and long, ball back towards your own posts",
      "Straight up off the floor. Do not lie there",
    ],
    progressions: ["A support player arrives to pick up and carry on"],
    regressions: ["Walk it", "Place from kneeling"],
    safety: "Ground contact only. No player touches another player in this one.",
    faults: [
      {
        looks: "Landing chest first with the arms underneath",
        say: "On your side. Arms need to be free",
      },
      {
        looks: "Lying there admiring the placement",
        say: "Straight up. Do not stay down",
      },
    ],
  },
  {
    id: "warmup-wrestle-for-the-ball",
    title: "Wrestle for the ball",
    kind: "warmup",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 6,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    softGround: true,
    diagram: {
      label: "Set up diagram. Two pairs kneeling face to face with a ball held between them.",
      space: [10, 10],
      defence: [[3, 3.4], [7, 3.4]],
      attack: [[3, 6.6], [7, 6.6]],
      ball: [[3, 5], [7, 5]],
    },
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs of similar size, both kneeling, one ball held between them.",
    howItRuns:
      "On go, both try to win the ball. Knees stay on the floor. Five seconds then stop, whoever has it wins the point. Best of six. They learn grip strength, a low body position and that letting go early loses you the ball, which is the whole lesson of the breakdown.",
    coachingPoints: [
      "Elbows in tight, ball pulled into your chest",
      "Get your weight over the ball, not leaning back",
      "Strong hands. Grip it like you mean it",
    ],
    progressions: ["Start on your feet in a crouch instead of kneeling"],
    regressions: ["One player attacks and one defends rather than both competing"],
    safety:
      "Knees down, heads up and to the side. No swinging anybody around. Stop it instantly if a head goes near the floor or anyone gets wound up.",
    faults: [
      {
        looks: "Elbows out wide where they can be pulled",
        say: "Elbows in. Squeeze it into your ribs",
      },
      {
        looks: "Leaning back to pull it away",
        say: "Get your weight over it, not behind it",
      },
    ],
  },
  {
    id: "warmup-body-position-ladder",
    title: "Body position ladder",
    kind: "warmup",
    themes: ["breakdown"],
    minAge: "u10",
    minutes: 6,
    players: { min: 6 },
    space: "15 m channel",
    diagram: {
      label:
        "Set up diagram. Six cones a metre and a half apart. The front of the wave walks the line dropping into a crouch at each cone.",
      space: [10, 15],
      cones: [[5, 10], [5, 8.5], [5, 7], [5, 5.5], [5, 4], [5, 2.5]],
      defence: [[5, 12.9], [5, 14.4]],
      attack: [[5, 11.4]],
      runs: [[[6.3, 10.8], [6.3, 1.9]]],
    },
    equipment: [{ item: "cone", qty: 6 }],
    setup: "Six cones in a line, a metre and a half apart. Waves of three or four.",
    howItRuns:
      "Walk the line dropping into a low crouch at every cone. Flat back, head up, hands ready. Then jog it. Then jog it and stay low for three strides past each cone. Three lengths each. It looks like nothing. It is the difference between arriving at a ruck upright and arriving useful.",
    coachingPoints: [
      "Flat back. If you are looking at the grass you are wrong",
      "Bend at the knees not the waist",
      "Hands out in front, ready to grab something",
    ],
    progressions: ["Add a shield to grip and hold at the last cone"],
    regressions: ["Walk the whole thing", "Fewer cones so there is more time between them"],
    safety: "No contact with another player. Bodies only.",
    faults: [
      {
        looks: "Bending at the waist with a rounded back",
        say: "Bend your knees. Back stays flat",
      },
      {
        looks: "Head down looking at the grass",
        say: "If you can see the floor, you are wrong",
      },
    ],
  },
  {
    id: "warmup-scrum-shape-hold",
    title: "Scrum shape hold",
    kind: "warmup",
    themes: ["setpiece"],
    minAge: "u10",
    minutes: 5,
    players: { min: 3 },
    space: "10 x 10 m",
    diagram: {
      label: "Set up diagram. A front row of three bound together with nobody opposite.",
      space: [10, 10],
      attack: [[3.9, 5.5], [5, 5.5], [6.1, 5.5]],
    },
    equipment: [],
    setup: "Threes. Hooker in the middle, prop either side. No opposition at all.",
    howItRuns:
      "Crouch, bind, hold for five seconds, stand up. Six of those. Nobody pushes anything, nobody engages anything. You are getting the shape right while everyone is still fresh so the shape is right later when they are tired.",
    coachingPoints: [
      "Flat backs and heads up on crouch. Looking at the floor means reset",
      "Bind properly onto your own player before anything else",
      "Feet under you, weight balanced. Do not lean",
    ],
    progressions: ["Hold for eight seconds", "Add the scrum half calling the sequence"],
    regressions: ["Two players instead of three", "Hold for three seconds"],
    safety:
      "No opposition and no pushing in this one. It exists so the front row learns the shape without a load on it.",
    faults: [
      {
        looks: "Heads down on crouch",
        say: "Eyes up. Look at the player opposite",
      },
      {
        looks: "Leaning on each other rather than standing on their own feet",
        say: "Feet under you. Hold your own weight",
      },
    ],
  },
  {
    id: "warmup-numbers-scramble",
    title: "Numbers scramble",
    kind: "warmup",
    themes: ["gamesense"],
    minAge: "u8",
    minutes: 5,
    players: { min: 8, max: 24 },
    space: "20 x 20 m",
    diagram: {
      label:
        "Set up diagram. A square with everyone jogging inside it. Three have grouped up on the call while the rest run to find their group.",
      space: [20, 20],
      cones: [[0, 0], [20, 0], [0, 20], [20, 20]],
      defence: [[4, 5], [7.5, 12], [3, 15.5], [10, 17.5], [17.5, 13.5]],
      attack: [[13, 7], [14.6, 8], [13.2, 9.4]],
      runs: [[[8.7, 11.2], [11.9, 9.4]], [[10.5, 16.2], [13.4, 11]]],
    },
    equipment: [{ item: "cone", qty: 4 }],
    setup: "Everyone jogging inside a square.",
    howItRuns:
      "Shout a number and they have to get into groups of that size, sat down, as fast as possible. Anybody left over does five star jumps. Then start shouting shapes instead of numbers. A triangle of four. A line of three. Six goes. Gets them listening and moving before you ask them to listen to anything harder.",
    coachingPoints: [
      "Move towards people, do not stand and wait to be picked",
      "Count out loud so your group knows if it is right",
      "Head up while you jog so you can see who is near you",
    ],
    progressions: ["Call two numbers and they pick which to make", "No talking allowed"],
    regressions: ["Walk it", "Only call numbers, no shapes"],
    faults: [
      {
        looks: "Standing still waiting to be picked up by a group",
        say: "Move towards people. Go and find a group",
      },
      {
        looks: "Counting silently then getting it wrong",
        say: "Count out loud so you can hear each other",
      },
    ],
  },
  {
    id: "warmup-hospital-pass",
    title: "Hospital pass",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u9",
    minutes: 6,
    players: { min: 6, max: 18 },
    space: "15 x 15 m",
    diagram: {
      label:
        "Set up diagram. Two pairs six metres apart, deliberately throwing each other a pass that is wide or short.",
      space: [15, 15],
      defence: [[4, 5], [11, 5]],
      attack: [[4, 11], [11, 11]],
      passes: [[[4, 10.1], [5.7, 5.9], 0.8], [[11, 10.1], [9.8, 6.6], -0.8]],
    },
    equipment: [{ item: "ball", qty: 1, per: "pair" }],
    setup: "Pairs, six metres apart, one ball each.",
    howItRuns:
      "Deliberately throw each other bad passes. Too high, too low, behind them, at their feet. Twenty each. They will laugh at it and they will also get much better at taking a scruffy pass, which is most of the passes they will get on a Sunday.",
    coachingPoints: [
      "Get your feet to it. Do not just reach",
      "Low ball, get your hands under it with little fingers together",
      "Take it cleanly then reset before you throw one back",
    ],
    progressions: ["Both moving while you do it", "Bad passes at pace"],
    regressions: ["Closer together", "Only slightly bad passes to start"],
    faults: [
      {
        looks: "Reaching for the low ball without moving the feet",
        say: "Feet to it first. Then your hands",
      },
      {
        looks: "Fingers apart so it goes straight through",
        say: "Little fingers together underneath it",
      },
    ],
  },
  {
    id: "warmup-three-corner-sprint",
    title: "Three corner sprint",
    kind: "warmup",
    themes: ["evasion"],
    minAge: "u9",
    minutes: 6,
    players: { min: 6 },
    space: "15 x 15 m",
    diagram: {
      label:
        "Set up diagram. Three cones in a triangle ten metres a side with a start cone beside them. One runner works round it while the rest of the wave waits.",
      space: [15, 15],
      cones: [[2.5, 12.5], [12.5, 12.5], [7.5, 3.8], [1, 14.2]],
      defence: [[2.8, 14.2], [4.6, 14.2]],
      attack: [[3.6, 11.2]],
      runs: [[[4.3, 10.3], [7.1, 5.2]], [[8, 4.6], [11.9, 11.4]], [[11.9, 13.3], [5.9, 13.3]]],
    },
    equipment: [{ item: "cone", qty: 4 }],
    setup: "Three cones in a triangle, about ten metres a side. Waves of three or four.",
    howItRuns:
      "Jog the first lap, stride the second, then run it properly with a hard turn at every cone. Three laps each with a walk between. Turning hard at pace is a skill and doing it cold is how ankles go, so this comes after the movement prep rather than before it.",
    coachingPoints: [
      "Small steps into the turn, big steps out of it",
      "Drop your hips as you turn, do not stay upright",
      "Push off the outside foot",
    ],
    progressions: ["Carry a ball", "Turn the other way round the triangle"],
    regressions: ["Wider triangle", "Jog all three laps"],
    faults: [
      {
        looks: "Running wide round the cone rather than turning at it",
        say: "Little steps in. Turn tight",
      },
      {
        looks: "Staying upright through the turn and losing all the speed",
        say: "Drop your hips. Lean into it",
      },
    ],
  },
  {
    id: "warmup-tackle-tube-roll",
    title: "Roll and reset",
    kind: "warmup",
    themes: ["tackle"],
    minAge: "u10",
    minutes: 5,
    players: { min: 4 },
    space: "10 x 10 m",
    softGround: true,
    diagram: {
      label:
        "Set up diagram. Four players spread out with a couple of metres each, rolling over a shoulder and back to their feet.",
      space: [10, 10],
      attack: [[3, 3], [7, 3], [3, 7], [7, 7]],
      runs: [
        [[2, 4.2], [4, 4.2], 0.9],
        [[8, 4.2], [6, 4.2], -0.9],
        [[2, 8.2], [4, 8.2], 0.9],
        [[8, 8.2], [6, 8.2], -0.9],
      ],
    },
    equipment: [],
    setup: "Everyone with a couple of metres of space. Grass, checked first.",
    howItRuns:
      "Down on your side, roll over one shoulder, back to your feet. Then the other side. Ten each way. Slow at first, then quicker. Learning to roll rather than land flat is the thing that keeps shoulders and collarbones in one piece.",
    coachingPoints: [
      "Chin tucked. Never let the back of your head touch the floor",
      "Roll across the shoulder, not straight over your neck",
      "Land on your side, then push up",
    ],
    progressions: ["Roll and get up facing a direction you call out"],
    regressions: ["Start from kneeling", "Roll without getting up"],
    safety:
      "Ground contact only, nobody touches anybody. Check the pitch for stones first and skip it entirely if the ground is hard or frozen.",
    faults: [
      {
        looks: "The head going back towards the floor",
        say: "Chin tucked. Look at your own tummy",
      },
      {
        looks: "Rolling straight over the top of the neck",
        say: "Across your shoulder, on the diagonal",
      },
    ],
  },
  {
    id: "warmup-grip-and-drive",
    title: "Grip and drive",
    kind: "warmup",
    themes: ["breakdown"],
    minAge: "u11",
    minutes: 6,
    players: { min: 6, max: 20 },
    space: "10 x 10 m",
    softGround: true,
    diagram: {
      label: "Set up diagram. One pair already in contact, driving the shield back three steps.",
      space: [10, 10],
      shields: [[5, 6.5]],
      attack: [[5, 7.4]],
      runs: [[[6.2, 6.9], [6.2, 3.4]]],
    },
    equipment: [{ item: "tackle shield", qty: 1, per: "pair" }],
    setup: "Pairs of similar size. One holds a shield low, the other in a crouch in front of it.",
    howItRuns:
      "Grip the shield with both arms, get low, drive it back three steps with your legs. Six each. No running in, no impact at all, you start already touching it. It warms up the exact positions the ruck asks for without any collision.",
    coachingPoints: [
      "Both arms bound before your feet move",
      "Short powerful steps. Do not lunge",
      "Flat back, head up and to the side",
    ],
    progressions: ["Five steps", "Shield holder resists harder"],
    regressions: ["Two steps", "No resistance at all"],
    safety:
      "You start in contact, so there is no impact in this one. Shield holders resist but never drive back. Match by size.",
    faults: [
      {
        looks: "Feet moving before the arms are bound",
        say: "Grip first. Then walk",
      },
      {
        looks: "Long lunging steps that stand them up",
        say: "Short steps. Lots of little ones",
      },
    ],
  },
  {
    id: "warmup-two-lap-and-in",
    title: "Two lap and in",
    kind: "warmup",
    themes: ["handling"],
    minAge: "u11",
    minutes: 6,
    players: { min: 8 },
    space: "30 x 20 m",
    diagram: {
      label:
        "Set up diagram. A rectangle with a pair jogging the lap, passing back and forward as they go.",
      space: [30, 20],
      cones: [[0, 0], [30, 0], [0, 20], [30, 20]],
      defence: [[9, 15]],
      attack: [[3.5, 14]],
      runs: [
        [[3, 11.5], [3, 3.5]],
        [[4.5, 2.5], [25.5, 2.5]],
        [[27, 4], [27, 16.5]],
        [[25.5, 17.5], [12, 17.5]],
      ],
      passes: [[[4.7, 14.2], [7.8, 14.8]]],
    },
    equipment: [{ item: "cone", qty: 4 }, { item: "ball", qty: 1, per: "pair" }],
    setup: "A rectangle. Pairs with a ball between them.",
    howItRuns:
      "Two laps passing back and forward as you jog. Then in to the middle for ten passes each side standing still, then two more laps at three quarter pace. Simple, but it means their hands are warm before you ask them to do anything hard with them.",
    coachingPoints: [
      "Pass in front so they never break stride",
      "Late hands. Do not telegraph it",
      "Both hands on the ball before you pass it on",
    ],
    progressions: ["Threes instead of pairs so there is a proper line to move"],
    regressions: ["One lap", "Walk the first lap"],
    faults: [
      {
        looks: "Passing behind the receiver so they have to check",
        say: "In front of them. They should never slow down",
      },
      {
        looks: "The pass telegraphed early with the arms out",
        say: "Late hands. Hold it until the last moment",
      },
    ],
  },
];
