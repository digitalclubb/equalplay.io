import type { Theme } from "./types.js";
import type { GuideFaq, GuideSection } from "./guides.js";

/**
 * How to teach the parts of the game a volunteer has never done.
 *
 * The rules guides in `guides.ts` say what a grade is allowed to do. That is
 * the question a coach asks in August. The question they ask in the car park in
 * October is different: the squad is allowed to scrummage now, so what does a
 * parent who never played actually say to eight children about it?
 *
 * Nothing else in the product answered that. A drill says how to run ten
 * minutes. A session says how to run an evening. Neither says which ten minutes
 * comes first, or what the referee will shout on Sunday, or why the first month
 * is two children kneeling on the grass doing something that looks like nothing.
 *
 * One guide per theme with an age floor above U7, so the four here are the four
 * phases Regulation 15 lets in part way through the minis game. Handling and
 * evasion need no guide of this kind: a parent who never played can still see
 * what a pass is meant to look like.
 *
 * Written from the RFU's age grade coaching material, World Rugby's Tackle
 * Ready framework and the coaching progressions those are built on, then put in
 * our own words the way every other word here is. The rules claims inside them
 * are the same claims `guides.ts` makes, because a coaching guide that
 * disagrees with the rules guide is worse than no coaching guide.
 *
 * Text is plain. No markup, no links, no HTML. Both renderers escape every
 * string, which is what lets this be edited without thinking about tags.
 */

export interface CoachingGuide {
  /**
   * The address, in both publications. `#/guide/<slug>` in the hub and
   * `/how-to-teach-rugby-<slug>` as a page. One word rather than two fields,
   * so the route and the URL cannot drift apart.
   */
  slug: string;
  /** What it teaches, so the drills behind it are the ones a coach already has. */
  theme: Theme;
  title: string;
  /** One line for the card on the guide index. */
  blurb: string;
  standfirst: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
}

/** The note every one of these carries, because none of it is Regulation 15. */
export const COACHING_SOURCE_NOTE =
  "The rules on this page are Regulation 15 and they are the RFU's. How to teach it is " +
  "ours, written from the RFU's age grade coaching material and World Rugby's Tackle " +
  "Ready, then tried on a Tuesday night. A club coach who has done this for ten years " +
  "will have a better order than ours for some of it. Take theirs.";

export const COACHING_GUIDES: CoachingGuide[] = [
  {
    slug: "tackling",
    theme: "tackle",
    title: "How to teach tackling from scratch",
    blurb:
      "From wrestling games to a live one against one, in the order a nine year old can take it.",
    standfirst:
      "The tackle arrives at U9 and it's the part of the job most volunteers dread, usually " +
      "because nobody ever taught them either. It goes in five steps over about six weeks, " +
      "starting with two children on their knees.",
    sections: [
      {
        heading: "Before anybody tackles anybody",
        blocks: [
          {
            text:
              "U9 is the first grade with a tackle in it. Nobody competes for the ball once " +
              "it's on the floor, so the only thing you're teaching this season is how to take " +
              "somebody down safely and how to go down safely. That's plenty.",
          },
          {
            items: [
              {
                lead: "Pair them by size, never by age.",
                text: "The biggest child in an U9 squad can be twice the weight of the smallest",
              },
              {
                lead: "Soft grass only.",
                text: "If the pitch is frozen or baked hard, do something else that night",
              },
              {
                lead: "Contact below the base of the sternum.",
                text: "Tummy or below. That line does not move at any grade in minis",
              },
              {
                lead: "Little and often beats one long session.",
                text: "Ten good minutes early on, while they're fresh, rather than half an hour at the end",
              },
              {
                lead: "Stop it the moment technique goes.",
                text: "Tired children put their heads in the wrong place",
              },
            ],
          },
          {
            text:
              "Read the U9 rules guide alongside this. It says what a tackle is allowed to be " +
              "at that grade, which is narrower than what the parents on the touchline will be " +
              "expecting.",
          },
        ],
      },
      {
        heading: "The order to teach it in",
        blocks: [
          {
            text:
              "Six weeks, roughly. Do not skip a step because the session looked easy. The " +
              "step everybody skips is the first one.",
          },
          { subheading: "One: get them used to falling over" },
          {
            text:
              "Wrestling games on the grass, knees down, nobody holding a ball. Pull a partner " +
              "over a line. Sit back to back and get up together. Half the squad has never had " +
              "anybody's arms round them. The other half has, at home, which is worse, because " +
              "they think that's what a tackle is. Neither is ready for technique yet.",
          },
          { subheading: "Two: on their knees, no running at all" },
          {
            text:
              "Pairs kneeling a metre apart. The tackler puts their head to the side of the " +
              "carrier's hip, wraps both arms round the legs, squeezes then they roll over " +
              "together. Ten each side before anybody stands up. This is the session that " +
              "decides whether the head goes in the right place for the rest of their life.",
          },
          { drills: ["drill-cheek-to-cheek"] },
          { subheading: "Three: from a crouch, carrier walking" },
          {
            text:
              "Same tackle, tackler now in a crouch with knees bent, carrier walking past at " +
              "arm's length. The new thing is footwork. Small steps in, leading foot close to " +
              "the carrier, leading shoulder following it.",
          },
          { subheading: "Four: side on at a jog" },
          {
            text:
              "The carrier jogs a straight line and the tackler comes from the side. Side on " +
              "first because the geometry is kinder: the head has an obvious place to go and " +
              "nobody is running at anybody. Only move on once the head is right every single " +
              "time rather than most times.",
          },
          { drills: ["drill-side-on-tackle", "drill-track-and-close"] },
          { subheading: "Five: get up and do it again" },
          {
            text:
              "A tackle nobody gets up from is half a skill. The tackler releases, gets to " +
              "their feet and is ready before the next carrier arrives. Front on work belongs " +
              "here too, once side on is honest, though at U9 there's still nobody competing " +
              "for the ball on the floor.",
          },
          { drills: ["drill-tackle-and-get-up", "drill-front-on-tackle"] },
        ],
      },
      {
        heading: "The five parts of a tackle",
        blocks: [
          {
            text:
              "World Rugby's Tackle Ready breaks the tackle into five stages. It's written for " +
              "every level from a nine year old to a professional, so it's worth knowing the " +
              "words even if you only ever use the first three.",
          },
          {
            table: {
              caption: "The five stages, in the order they happen.",
              head: ["Stage", "What it means on a Tuesday"],
              rows: [
                ["Tracking", "Running at the carrier's inside shoulder rather than at where they are now"],
                ["Preparation", "Knees bent, chin off the chest, eyes on the target, feet still moving"],
                ["Connection", "Shoulder into the tummy or the thigh, head to the side, both arms round"],
                ["Acceleration", "Legs keep driving through the contact rather than stopping at it"],
                ["Finish", "Land on top or beside, release, get up, ready for the next one"],
              ],
            },
          },
          {
            text:
              "At U9 you're working on the middle three. Tracking is the one that takes " +
              "longest, because it's a decision rather than a body position, so it keeps " +
              "improving right through U12.",
          },
        ],
      },
      {
        heading: "What to say",
        blocks: [
          {
            text:
              "Pick three of these and use the same three all night. A child who hears seven " +
              "cues hears none of them.",
          },
          {
            items: [
              { text: "Head to the side, cheek on their back pocket" },
              { text: "Eyes open all the way in" },
              { text: "Chin off your chest" },
              { text: "Small quick steps, don't lunge" },
              { text: "Both arms round then squeeze. A tackle is a hug" },
              { text: "Keep your legs going after you hit" },
              { text: "Up on your feet straight away" },
            ],
          },
        ],
      },
      {
        heading: "What going wrong looks like",
        blocks: [
          {
            table: {
              caption: "The five you'll see most, plus the thing to say about each.",
              head: ["What you see", "What to say"],
              rows: [
                ["Head going in front of the carrier", "Stop the drill. Ear to their back pocket before you wrap"],
                ["Arms pushing rather than gripping", "Lock your hands together behind their legs"],
                ["Diving in from a metre away", "Get close enough to touch them first"],
                ["Standing up straight on the way in", "Bend your knees, not your back"],
                ["Eyes shut at the moment of contact", "Watch the target the whole way. Eyes open"],
                ["Tackling then lying there", "Straight back up, you're in the game"],
              ],
            },
          },
        ],
      },
      {
        heading: "The carrier's half of it",
        blocks: [
          {
            text:
              "Half the squad is being tackled at any moment, so coach that too. A carrier who " +
              "knows how to go to ground gets hurt less than one who doesn't, which is worth " +
              "more than any tackle technique you'll teach.",
          },
          {
            items: [
              { lead: "Fall on your side, not your front.", text: "Twist as you go so the shoulder lands first" },
              { lead: "Long arms with the ball.", text: "Place it back towards your own team, as far from your body as you can reach" },
              { lead: "Never dip your shoulders below your hips", text: "going into contact, which is a penalty as well as a danger" },
              { lead: "Get up quickly.", text: "At U10 the ball is live again the moment you've placed it" },
              { lead: "Squeezeball is banned", text: "at every grade and no coach may teach it, anywhere" },
            ],
          },
          { drills: ["drill-long-placement", "drill-turn-the-turtle"] },
        ],
      },
      {
        heading: "How it changes as they go up",
        blocks: [
          {
            table: {
              caption: "What the tackle turns into, grade by grade.",
              head: ["Grade", "What's new", "What to work on"],
              rows: [
                ["U9", "The tackle arrives. Nobody competes for the ball once it's down", "Head position, the wrap, getting up"],
                ["U10", "An opponent may grab the ball if the carrier is still up. Ruck and maul arrive", "Tackle then compete, front on work, the offside line"],
                ["U11", "The contest at the breakdown doubles to two against two", "Two players arriving together, tackling when tired"],
                ["U12", "Tackling stays as it was. The hand off below the armpits arrives", "Holding a carrier up, choosing which tackle to make"],
              ],
            },
          },
          { drills: ["drill-two-tackle-shuttle", "drill-double-tackle"] },
        ],
      },
    ],
    faqs: [
      {
        question: "One of them is frightened of contact. What do I do?",
        answer:
          "Put them back a step rather than out of the session. Kneeling work with a partner they " +
          "like, no ball, nobody watching. Most of it is fear of the unknown and it goes after " +
          "three or four weeks of small successes. If it doesn't, they can play the rest of the " +
          "session and nobody should make a thing of it.",
      },
      {
        question: "Can we use tackle bags and shields?",
        answer:
          "For shape, yes. Keep it brief. A bag doesn't move, doesn't step and doesn't fall " +
          "over, so a squad that only ever tackles bags gets a shock on Sunday. Use one to " +
          "practise the shoulder and the wrap, then get back to a person walking.",
      },
      {
        question: "How do I pair them up when the sizes are all over the place?",
        answer:
          "By weight rather than by name or age. Redo it every few weeks because they grow " +
          "at different rates. If a pairing looks uneven to you on the touchline, it is uneven. " +
          "Three groups by size is usually enough for a minis squad.",
      },
      {
        question: "What do I do if somebody takes a bang to the head?",
        answer:
          "They come off and they stay off. The RFU's Headcase guidance is the one piece of " +
          "reading every minis coach should do before the season starts. If in doubt, sit " +
          "them out. No child goes back on the same day after a suspected concussion.",
      },
      {
        question: "Do I need a qualification to coach tackling?",
        answer:
          "Your club will want you on an RFU coaching course and it's worth doing, though the " +
          "bigger reason is that a couple of hours with somebody who packs down every week will " +
          "teach you more about the first two sessions than any page will.",
      },
    ],
  },
  {
    slug: "rucking",
    theme: "breakdown",
    title: "How to teach rucking and mauling from scratch",
    blurb:
      "The floor first, then the arriving player, then a contest that's one against one at U10.",
    standfirst:
      "Rucks arrive at U10 and the first month of them is chaos in every club in the country. " +
      "The way out is to coach the second after the tackle before you coach the contest, " +
      "because most of what looks like bad rucking is a ball nobody could have won.",
    sections: [
      {
        heading: "What actually arrives at U10",
        blocks: [
          {
            text:
              "Less than the parents think. The ruck at this grade is capped at two players a " +
              "side counting the carrier and the tackler, so it's a contest between one arriving " +
              "player and one other. It's not a pile.",
          },
          {
            items: [
              { lead: "Everybody stays on their feet.", text: "Off your feet and it's a free pass against you" },
              { lead: "One supporting player each.", text: "The cap of two includes the carrier and the opponent" },
              { lead: "Five seconds once it's won.", text: "The referee calls \"Use it\" and the clock is short" },
              { lead: "Come through the gate.", text: "Join from behind your own team's hindmost foot, never from the side" },
              { lead: "Drive over, then the next player passes it.", text: "Nobody gets to stand there guarding it" },
            ],
          },
          {
            text:
              "The U10 rules guide has the whole thing. Read it before the first contact session " +
              "of the season rather than after the first Sunday, because this is the part " +
              "referees will actually stop the game for.",
          },
        ],
      },
      {
        heading: "Teach the floor before the contest",
        blocks: [
          {
            text:
              "Three quarters of a bad ruck is a bad placement. If the ball ends up under the " +
              "tackled player's chest, nobody on earth is clearing it, so this comes first and " +
              "keeps coming back all season.",
          },
          {
            items: [
              { lead: "Long arms.", text: "Place the ball back towards your own team, stretched out as far as you can reach" },
              { lead: "On your side, not your front.", text: "Twist as you land so the shoulder goes down first" },
              { lead: "Then roll away.", text: "Away from the ball and out of everybody's road, quickly" },
              { lead: "The tackler gets up first.", text: "Release, stand up, then you're allowed to touch the ball again" },
            ],
          },
          { drills: ["drill-long-placement", "drill-turn-the-turtle", "drill-tackle-and-get-up"] },
        ],
      },
      {
        heading: "The order to teach it in",
        blocks: [
          { subheading: "One: arrive and stay standing" },
          {
            text:
              "A ball on the floor, a cone either side, one player arriving to step over it and " +
              "stay up. No opposition at all. It looks trivial for about four minutes, then you " +
              "see how many of them fall over their own feet.",
          },
          { drills: ["drill-step-over-and-stay"] },
          { subheading: "Two: the arriving shape" },
          {
            text:
              "Fast, then balanced, then in. They sprint to get there, drop into a crouch with " +
              "short steps a metre out, then go in low with the shoulder and keep the legs " +
              "driving. The crouch is the bit everybody leaves out, which is why they arrive " +
              "upright and bounce off.",
          },
          { subheading: "Three: one against one" },
          {
            text:
              "Now add the defender over the ball. Shoulder under their chest, drive through " +
              "them rather than at them, feet never stopping. At this grade that's the whole " +
              "contest, so it's worth doing properly rather than adding numbers.",
          },
          { drills: ["drill-clear-the-threat", "drill-two-second-ruck"] },
          { subheading: "Four: who goes in, who stays out" },
          {
            text:
              "The decision is harder than the technique. Two go in, everybody else stays on " +
              "their feet in the line ready for the pass. Left alone, all eight will pile in " +
              "and your squad will get scored against down the outside every week.",
          },
          { drills: ["drill-who-goes-in", "drill-five-second-count"] },
        ],
      },
      {
        heading: "The maul, which is the ruck standing up",
        blocks: [
          {
            text:
              "A maul starts when the carrier is held up by an opponent and one of their own " +
              "team binds on. Three players, all on their feet, all going somewhere. Same cap as " +
              "the ruck at U10 and the same five seconds once it's formed.",
          },
          {
            items: [
              { lead: "Stay tall.", text: "Heads and shoulders up, small steps, feet never together" },
              { lead: "Bind properly.", text: "A hand on a shirt is not a bind. Whole arm, gripped" },
              { lead: "Turn your back on them.", text: "The carrier turns side on so the ball is away from the opposition" },
              { lead: "Move it before it stops.", text: "A maul that has stopped going forward has to release the ball straight away" },
            ],
          },
          {
            text:
              "The one that catches sides out: when the carrier is held but still upright and " +
              "has stopped going forward, the ball has to come out of there. There's no count " +
              "and no shout to wait for. Half your first month at U10 is spent teaching them to " +
              "move it before anybody tells them to.",
          },
          { drills: ["drill-maul-three-and-move"] },
        ],
      },
      {
        heading: "What to say",
        blocks: [
          {
            items: [
              { text: "Long arms with that ball" },
              { text: "Roll away, you're in the road" },
              { text: "Get low before you get there" },
              { text: "Through him, not into him" },
              { text: "Feet, feet, feet" },
              { text: "Two in. Everybody else get out and get in the line" },
              { text: "Stay on your feet or it's their ball" },
            ],
          },
        ],
      },
      {
        heading: "What going wrong looks like",
        blocks: [
          {
            table: {
              caption: "The failures you'll actually see, week one to week six.",
              head: ["What you see", "What to say"],
              rows: [
                ["Everybody piling in, nobody in the backline", "Two in. If somebody's already there, you're out"],
                ["Arriving upright and bouncing off", "Crouch before you get there, then go through"],
                ["Diving on top of the ball", "On your feet or you've given it away"],
                ["The ball under the tackled player", "Long arms. Reach it back to your own side"],
                ["Tackler lying over the ball", "Up first, then you can touch it"],
                ["Joining from the side", "Round the back and in through the gate"],
              ],
            },
          },
        ],
      },
      {
        heading: "How it changes as they go up",
        blocks: [
          {
            table: {
              caption: "The breakdown, grade by grade.",
              head: ["Grade", "What's new", "What to work on"],
              rows: [
                ["U10", "Ruck and maul arrive, capped at two a side", "Placement, arriving on your feet, one against one"],
                ["U11", "The cap goes to three a side, so it's two against two", "Two arriving together, counter rucking, the maul"],
                ["U12", "No cap at all. As many as you like", "Deciding who goes in, ruck to ruck, speed of ball"],
              ],
            },
          },
          { drills: ["drill-counter-ruck", "drill-pick-and-go"] },
        ],
      },
    ],
    faqs: [
      {
        question: "Why is my squad's ruck always a pile of bodies?",
        answer:
          "Because nobody's told them how many go in. The number at U10 is one supporting player " +
          "each, so say it out loud every session until it sticks. Standing a coach in the " +
          "backline shouting for the ball helps more than anything you do at the ruck itself.",
      },
      {
        question: "What is squeeze ball and why does everybody go on about it?",
        answer:
          "It's going to ground and squeezing the ball out between your legs rather than placing " +
          "it. It's banned at every age grade and no coach may teach it, because it puts a child " +
          "head first into the floor with people arriving over the top. If you see it, stop it " +
          "and explain why.",
      },
      {
        question: "Can they pick the ball up and run from a ruck?",
        answer:
          "Only if no ruck has formed yet. Once it has, the ball has to be passed away. At U10 a " +
          "player who's driven over the ball can't then pick it up themselves either, so the next " +
          "one there passes it.",
      },
      {
        question: "How do I coach this without anybody getting hurt?",
        answer:
          "Soft ground, sizes matched, walking pace for the first two weeks and shoulders never " +
          "below hips. Most breakdown injuries in minis are a knee or a head meeting somebody " +
          "arriving too fast to stop, so slow the arrival down until the shape is right.",
      },
    ],
  },
  {
    slug: "scrums",
    theme: "setpiece",
    title: "How to teach the scrum from scratch",
    blurb: "Kneeling one against one, then three, then the calls the referee will make on Sunday.",
    standfirst:
      "Nobody pushes at any minis grade and the scrum is only there to restart the game, which " +
      "is the first thing to know if you never packed down yourself. Here's the order, from " +
      "two children on their knees to a front row that holds its shape.",
    sections: [
      {
        heading: "What an U10 scrum is for",
        blocks: [
          {
            text:
              "Restarting the game after a knock on or a forward pass. That's the whole job. " +
              "It isn't a shoving contest, it isn't where you win the ball back and it shouldn't " +
              "be where your three biggest children live all season.",
          },
          {
            items: [
              { lead: "Three players a side.", text: "A prop either side of a hooker, taken from the nearest three to the stoppage" },
              { lead: "The fourth nearest is the scrum half.", text: "Which means everybody ends up doing that job too" },
              { lead: "Nobody pushes.", text: "At all. Not a shove, not a nudge, not a lean" },
              { lead: "Only the side putting it in may strike.", text: "That changes at U11 when both hookers may go for it" },
              { lead: "Heads and shoulders never below the hips.", text: "No downward pressure, no charging in" },
            ],
          },
          {
            text:
              "The RFU's own phrase for how it should be staffed is \"all players trained, late " +
              "specialisation\", which in practice means everybody in your squad packs down at " +
              "some point over a season. That's deliberate rather than an accident of numbers.",
          },
        ],
      },
      {
        heading: "Body shape first, with nobody touching anybody",
        blocks: [
          {
            text:
              "Ten minutes, no opposition, no ball. This is the session that makes the next five " +
              "work and it's the one every coach is tempted to skip.",
          },
          {
            items: [
              { text: "Feet about shoulder width, toes pointing forwards" },
              { text: "Knees bent. Bent knees, not a bent waist" },
              { text: "Weight on the balls of the feet rather than back on the heels" },
              { text: "Chest pushed forward so there's a dip in the back rather than a hump" },
              { text: "Head up, eyes open, looking at the far side" },
              { text: "Shoulders above hips, every single time" },
            ],
          },
          {
            text:
              "The fault to watch for is straight legs with a bend at the waist, which looks " +
              "near enough right from the touchline and isn't. If they can't hold the position " +
              "for ten seconds on their own, they can't hold it with somebody leaning on them.",
          },
        ],
      },
      {
        heading: "On their knees, one against one",
        blocks: [
          {
            text:
              "Pairs of similar size, both kneeling, facing each other a metre apart. This is " +
              "where head position and binding get learned, at a speed where nothing can go " +
              "wrong. Give it a full session and go back to it whenever the shape slips.",
          },
          {
            items: [
              {
                lead: "Head to the left of their head.",
                text: "Every player's head ends up beside an opponent's rather than beside a team-mate's. Ear to ear",
              },
              {
                lead: "Bind with the outside arm.",
                text: "Grip the shirt on the back or the side of the player opposite",
              },
              {
                lead: "Never the sleeve, the collar or the chest.",
                text: "Those binds slip, which is how a scrum ends up on the floor",
              },
              {
                lead: "Rock gently to and fro.",
                text: "So they feel the weight across both shoulders before they ever feel it standing up",
              },
              {
                lead: "Call it properly from the first minute.",
                text: "Crouch, then bind, then set, in that order, every go",
              },
            ],
          },
          {
            text:
              "It looks like nothing is happening. What's happening is that eight children are " +
              "learning where a head goes, which is the only part of a scrum that can actually " +
              "hurt somebody.",
          },
        ],
      },
      {
        heading: "Up onto their feet, still one against one",
        blocks: [
          {
            text:
              "Same pairs, same calls, standing. Expect it to be worse than it was on their " +
              "knees for a fortnight. A nine or ten year old often hasn't got the trunk strength " +
              "to hold the position once their own weight is in it, so they'll bend at the waist " +
              "or drop their head. Go back to kneeling for a week if that happens.",
          },
          {
            items: [
              { text: "Tilt forward from the hips before you crouch, not after" },
              { text: "Knees stay bent the whole way through" },
              { text: "Bind first, then come together. Never the other way round" },
              { text: "Hold still on set. Nobody goes forward" },
            ],
          },
        ],
      },
      {
        heading: "Building the three",
        blocks: [
          {
            text:
              "Build it in the same order every time, so a child who's late or who's swapped in " +
              "still knows where they are meant to be.",
          },
          {
            items: [
              { lead: "Hooker first.", text: "They stand still and everybody else builds round them" },
              { lead: "Props bind on either side.", text: "Arm round the hooker's back, gripping between the armpit and the hip" },
              { lead: "Square up.", text: "Feet, hips and shoulders all facing the same way" },
              { lead: "Last of all, face the other three.", text: "Walk them in slowly the first dozen times" },
            ],
          },
          { drills: ["drill-three-player-scrum-shape", "drill-scrum-half-feed"] },
        ],
      },
      {
        heading: "The calls, so Sunday isn't a surprise",
        blocks: [
          {
            text:
              "Use the referee's words at training from day one. A child who's only ever heard " +
              "you say \"ready then\" will stand there on Sunday waiting for it.",
          },
          {
            table: {
              caption: "What the referee says, what it means.",
              head: ["The call", "What happens"],
              rows: [
                ["Crouch", "Both front rows sink into the position. Backs flat, heads up, nobody moving forward"],
                ["Bind", "Each prop reaches out and grips the shirt of the player opposite, on the back or the side"],
                ["Set", "The two front rows come together and hold. It is not a signal to push"],
                ["The whistle", "A collapse stops everything at once. Everybody stands up and it starts again from crouch"],
              ],
            },
          },
          {
            text:
              "Then the scrum half rolls it in down the middle of the tunnel, the hooker strikes " +
              "and the ball comes out the back. The scrum half has to pass it away rather than " +
              "run with it, which surprises them more than anything else on this page.",
          },
          { drills: ["drill-scrum-and-away"] },
        ],
      },
      {
        heading: "What to say",
        blocks: [
          {
            items: [
              { text: "Eyes up. If you can see the grass, reset" },
              { text: "Flat back, like a table top" },
              { text: "Head to the left of theirs, ear to ear" },
              { text: "Grab shirt, not sleeve" },
              { text: "Bend your knees, not your middle" },
              { text: "Nobody moves on set. Freeze and wait for the ball" },
            ],
          },
        ],
      },
      {
        heading: "What going wrong looks like",
        blocks: [
          {
            table: {
              caption: "Six things you'll see in the first month.",
              head: ["What you see", "What to say"],
              rows: [
                ["Heads down, looking at the grass", "Eyes up. Reset and go again"],
                ["Straight legs with a bent waist", "Knees bent. Sit down into it"],
                ["Somebody edging forward on set", "Nobody pushes. Hold still until it's in"],
                ["A bind slipping off a sleeve", "Back or side of the shirt. Get a fistful"],
                ["The scrum half running from the base", "Pass it. You're not allowed to run with it"],
                ["The same three children every scrum", "Swap the front row round. Everybody learns it"],
              ],
            },
          },
        ],
      },
      {
        heading: "How it changes as they go up",
        blocks: [
          {
            table: {
              caption: "The scrum, grade by grade.",
              head: ["Grade", "What it is", "What to work on"],
              rows: [
                ["U10", "Three players, uncontested, only the feeding side may strike", "Shape, head position, the calls, everybody gets a go"],
                ["U11", "Three players, both hookers may strike for the ball", "The hooker's timing, a straight feed, winning it back"],
                ["U12", "Five players a side", "Adding the second row, binding on, staying square"],
              ],
            },
          },
          { drills: ["drill-scrum-under-pressure", "drill-five-player-scrum"] },
          {
            text:
              "Nobody pushes at any of those grades. The shove arrives above the age range this " +
              "app covers, so if somebody at your club is teaching an U12 to drive, they're " +
              "teaching something Regulation 15 does not allow.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Do we teach them to push?",
        answer:
          "No. There's no push at any minis grade, so a season spent on it is a season teaching " +
          "something they aren't allowed to do and can't safely do either. Spend it on shape, " +
          "head position and getting the ball away quickly.",
      },
      {
        question: "Who should play hooker?",
        answer:
          "Everybody, over a season. The RFU's position is that all players should be trained " +
          "for the front row and that specialising comes much later. A squad where only three " +
          "children can pack down has no scrum at all the week two of them are away.",
      },
      {
        question: "One of them doesn't want to go in the front row. Is that allowed?",
        answer:
          "Yes. Nobody should be in there who doesn't want to be or whose technique isn't up to " +
          "it. The rules say as much: a player whose lack of technique or strength makes " +
          "them a danger has to be replaced. Keep asking them back every few weeks though, " +
          "because most change their minds once they've seen it done gently.",
      },
      {
        question: "When do we start practising lineouts?",
        answer:
          "You don't. There's no lineout at any grade this app covers. Touch is restarted with a " +
          "free pass right through U13, the uncontested lineout arrives at U14 and lifting is " +
          "held back to U15, so nothing before then needs a throw practised at training.",
      },
      {
        question: "The scrum keeps collapsing. What am I missing?",
        answer:
          "Usually one of three things: a bind on a sleeve, somebody with straight legs, or two " +
          "front rows going in at different heights. Stop it, put them back on their knees for " +
          "five minutes and rebuild it from there rather than shouting at it standing up.",
      },
      {
        question: "How long should we spend on scrums in a session?",
        answer:
          "Ten minutes, early on while they're fresh, once a fortnight is plenty at U10. It's a " +
          "restart, so the rest of the evening is better spent on what happens once the ball " +
          "comes out of it.",
      },
    ],
  },
  {
    slug: "kicking",
    theme: "kicking",
    title: "How to teach kicking from scratch",
    blurb: "The drop, then the strike, then the harder question of when it's worth kicking at all.",
    standfirst:
      "Kicking from hand arrives at U11 and it'll take up your September. Almost all of it " +
      "comes down to one thing nobody watches: how the ball leaves the hands. Get that right " +
      "and the rest follows in a fortnight.",
    sections: [
      {
        heading: "What U11 lets them do",
        blocks: [
          {
            text:
              "More than you'd expect and less than they'd like. Kicking from hand is allowed " +
              "anywhere on the pitch, so a squad that's never kicked before is suddenly allowed " +
              "to do it in a match.",
          },
          {
            items: [
              { lead: "Kicking from hand, anywhere.", text: "Restarts are drop kicks that have to travel 7 metres" },
              { lead: "No conversions, no drop goals, no box kicks.", text: "So there's no place kicking to teach at all" },
              { lead: "No fly hacking.", text: "Kicking a loose ball along the ground is still out" },
              { lead: "A mark can be called anywhere.", text: "From an open play kick, though not from a restart or a free kick" },
              { lead: "Knocking on a kick you're trying to catch isn't a knock on.", text: "At U11 only, so that they have a go rather than letting it bounce" },
            ],
          },
        ],
      },
      {
        heading: "The drop is the whole skill",
        blocks: [
          {
            text:
              "A punt is a drop with a leg swing after it. Nine times out of ten a bad kick is a " +
              "bad drop, so spend three sessions on the drop alone and don't let anybody kick " +
              "for distance until it's consistent.",
          },
          {
            items: [
              { lead: "Two hands on the ball, kicking-side hand underneath.", text: "The other hand steadies the middle" },
              { lead: "Ball upright, pointing slightly forwards.", text: "Held out in front, about waist high" },
              { lead: "Drop it, never throw it.", text: "The hands go down with the ball rather than letting go of it" },
              { lead: "Drop in line with the kicking leg.", text: "Not across the body, not out to the side" },
              { lead: "Eyes on the ball until the foot has hit it.", text: "Heads come up early. Every time" },
            ],
          },
          {
            text:
              "Practise it with no kick at all first. Hold, drop, catch it on the laces with the " +
              "foot still. If the ball lands flat on the instep with the toes pointed, the kick " +
              "is already most of the way there.",
          },
          { drills: ["drill-punt-to-your-partner"] },
        ],
      },
      {
        heading: "The order to teach it in",
        blocks: [
          { subheading: "One: drop and catch, no kick" },
          {
            text:
              "Standing still, drop the ball onto a still foot and catch it. Twenty of those a " +
              "side. It's dull and it's the reason the rest works.",
          },
          { subheading: "Two: short punts to a partner" },
          {
            text:
              "Five metres apart, half a leg swing, aiming to put it in their hands rather than " +
              "over their head. Accuracy first. A child who can drop a ball on a team-mate from " +
              "ten metres is more use than one who can boot it thirty into nobody.",
          },
          { subheading: "Three: a few steps and a target" },
          {
            text:
              "Two or three walking steps in, shoulders square, then kick to a cone or a coach " +
              "standing still. Distance comes from the strike being clean rather than from " +
              "swinging harder, which is worth saying out loud because they won't believe you.",
          },
          { subheading: "Four: catching it, which is the other half" },
          {
            text:
              "Somebody has to take the ball at the other end. Hands up early, eyes on it, turn " +
              "side on so the shoulder goes towards the chasers, call for it so a team-mate " +
              "doesn't run into you.",
          },
          { drills: ["drill-take-the-high-ball"] },
          { subheading: "Five: the other two kicks" },
          {
            text:
              "The grubber along the ground and the drop kick for a restart are separate skills " +
              "and they come after the punt. A drop kick is the fiddliest thing on this page, so " +
              "give it to whoever fancies it and let them practise it while everybody else warms " +
              "up.",
          },
          { drills: ["drill-grubber-into-space", "drill-drop-kick-restart"] },
        ],
      },
      {
        heading: "What to say",
        blocks: [
          {
            items: [
              { text: "Drop it, don't throw it" },
              { text: "Hands travel down with the ball" },
              { text: "Toes pointed like a ballet dancer" },
              { text: "Head down until it's gone" },
              { text: "Aim at somebody, not at the sky" },
              { text: "Chase your own kick" },
            ],
          },
        ],
      },
      {
        heading: "What going wrong looks like",
        blocks: [
          {
            table: {
              caption: "What you'll see in the first three weeks.",
              head: ["What you see", "What to say"],
              rows: [
                ["The ball tossed up before the kick", "Drop it from your hands. Stay with it on the way down"],
                ["It comes off the side of the foot", "Drop it in line with the leg you're kicking with"],
                ["Head lifting at the last moment", "Watch your foot hit it"],
                ["Enormous swing, terrible contact", "Half the swing, twice the accuracy"],
                ["Kicking straight to the other team", "Who are you kicking to? Find the space first"],
                ["Nobody chasing", "The kicker goes first. Everybody follows"],
              ],
            },
          },
        ],
      },
      {
        heading: "When to kick is harder than how",
        blocks: [
          {
            text:
              "A squad that's just learned to kick will kick everything, including good " +
              "possession on the opposition's 22. That's the September problem and it doesn't " +
              "get solved by technique.",
          },
          {
            items: [
              { lead: "Kick to space, not to a player.", text: "Behind a defence that's rushed up, into a corner, never down somebody's throat" },
              { lead: "Somebody has to chase it.", text: "An unchased kick is a present" },
              { lead: "Running is usually better at this age.", text: "Space is everywhere at U11 and a kick gives the ball away" },
              { lead: "Ask the question in the drill.", text: "Give them a defence that's sometimes up and sometimes back, then let them choose" },
            ],
          },
          { drills: ["drill-kick-or-run", "drill-counter-from-the-catch"] },
        ],
      },
      {
        heading: "How it changes as they go up",
        blocks: [
          {
            table: {
              caption: "Kicking, grade by grade.",
              head: ["Grade", "What's new", "What to work on"],
              rows: [
                ["U7 to U10", "No kicking of any kind", "Nothing. It isn't allowed and it isn't missed"],
                ["U11", "Kicking from hand anywhere, drop kick restarts", "The drop, short accurate punts, catching a high ball"],
                ["U12", "Kicking stays as it was", "Choosing between the kick and the run, counter attacking"],
              ],
            },
          },
        ],
      },
    ],
    faqs: [
      {
        question: "They can barely kick it five metres. Is that normal?",
        answer:
          "Completely. An eleven year old hasn't the leg length or the strength for distance and " +
          "chasing it makes the technique worse rather than better. Keep the targets close, keep " +
          "the swing short and the distance turns up on its own in a year or two.",
      },
      {
        question: "Should everyone learn to kick or just the fly half?",
        answer:
          "Everyone. Positions aren't fixed at minis and a squad with one kicker has no kicker " +
          "the week they're away. It's also one of the few skills a child can practise on their " +
          "own in the garden, which makes it worth giving to the whole squad.",
      },
      {
        question: "Why are there no conversions at this age?",
        answer:
          "Regulation 15 leaves them out, so there's no place kicking in the minis game at all. " +
          "A try is a try and the game restarts with a drop kick, which keeps everybody moving " +
          "instead of standing about watching one child and a kicking tee.",
      },
      {
        question: "What's the difference between a punt and a drop kick?",
        answer:
          "A punt is struck straight off the hands before it lands. A drop kick has to bounce " +
          "first, which is why it's harder and why restarts take longer to teach than anything " +
          "else in this section.",
      },
    ],
  },
];

/**
 * Where a coaching guide is published as a static page.
 *
 * Here rather than in `src/seo/`, for the same reason `drillPath` is in
 * `drills.ts`: both halves need it. Importing it from the page builder
 * would pull the whole static site generator into the hub's bundle.
 */
export function coachingPath(guide: CoachingGuide): string {
  return `/how-to-teach-rugby-${guide.slug}`;
}

/** The guide that teaches a theme, for the drill pages that want to link it. */
export function coachingGuideForTheme(theme: Theme): CoachingGuide | undefined {
  return COACHING_GUIDES.find((guide) => guide.theme === theme);
}

/** One guide by its slug. A Map, so nothing inherited off an object can match. */
const BY_SLUG = new Map(COACHING_GUIDES.map((guide) => [guide.slug, guide]));

export function coachingGuide(slug: string | undefined): CoachingGuide | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}
