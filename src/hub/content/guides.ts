import type { AgeGroup } from "./types.js";

/**
 * What each RFU age grade is allowed to do, in plain English.
 *
 * Data rather than markup, for the same reason the drills are: the renderer owns
 * every tag, so six guides cannot drift into six different shapes. The whole lot
 * ships in the bundle where the service worker can reach it too. A coach asking
 * "can we ruck yet" is often asking it on a touchline with no signal.
 *
 * Every claim here is written from the RFU's own rules of play for that grade,
 * checked against the appendices in August 2026. Reg 15 is reissued every
 * summer, so re-read the appendices each season rather than trusting this. The
 * view links each grade's appendix for exactly that reason.
 *
 * Text is plain. No markup, no links, no HTML of any kind. `guide.ts` escapes
 * every string it renders, which is what lets this be edited without anyone
 * having to think about it.
 */

export interface GuideTable {
  caption: string;
  /** First column heads the rows, so it is usually blank. */
  head: string[];
  rows: string[][];
}

/** `lead` is the bit in bold. Most list items in here have one. */
export interface GuideListItem {
  lead?: string;
  text: string;
}

export type GuideBlock =
  | { subheading: string }
  | { text: string }
  | { items: GuideListItem[] }
  | { table: GuideTable };

export interface GuideSection {
  heading: string;
  blocks: GuideBlock[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface Guide {
  ageGroup: AgeGroup;
  title: string;
  standfirst: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
}

/**
 * The one table every guide carries, so a coach can see the whole progression
 * from whichever grade they landed on. Written once here rather than six times.
 *
 * No lineout anywhere in it, because there is none at any grade this covers.
 * Reg 15 keeps touch restarting with a free pass through U13, brings the
 * uncontested lineout in at U14 and holds lifting back to U15.
 */
export const ARRIVALS: GuideTable = {
  caption: "The minis grades and the thing each one adds.",
  head: ["Grade", "Players", "What arrives"],
  rows: [
    ["U7", "4", "Tag. No contact at all"],
    ["U8", "6", "A bigger pitch and the six tag turnover"],
    ["U9", "7", "The tackle. Still no contest for the ball"],
    ["U10", "8", "Ruck, maul and a 3 player uncontested scrum. Contest is 1 against 1"],
    ["U11", "9", "Contest goes to 2 against 2. Both hookers may strike, kicking from hand"],
    ["U12", "12", "A 5 player scrum, no cap on the ruck, the hand off below the armpits"],
  ],
};

/** One line per grade for the index, so a coach can pick without reading six pages. */
export const GUIDE_BLURB: Record<AgeGroup, string> = {
  u7: "Tag, four a side, on 20 metres by 12. No contact beyond taking a tag off a belt.",
  u8: "Six a side on a pitch four times the size, plus the six tag turnover.",
  u9: "The tackle arrives. Still nobody competing for the ball once it is down.",
  u10: "Ruck, maul and a three player uncontested scrum. The contest is one against one.",
  u11: "Kicking from hand. The breakdown contest doubles to two against two.",
  u12: "Twelve a side, a five player scrum, no cap left on the ruck.",
};

export const GUIDES: Record<AgeGroup, Guide> = {
  u7: {
    ageGroup: "u7",
    title: "What U7 rugby actually is",
    standfirst:
      "Most of them have never held a rugby ball. U7 is tag, four a side, on a pitch 20 metres " +
      "by 12. No tackling, no kicking, no scrum. Here is the whole of it in plain English " +
      "before your first Sunday.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "U7 is the first grade there is, so nothing arrives and nothing goes. What " +
              "matters is knowing where the edges are, because almost everything a parent on " +
              "the touchline expects to see is out.",
          },
          {
            items: [
              {
                lead: "Four a side.",
                text: "On a pitch about a quarter the size of the one at U9.",
              },
              { lead: "No contact of any kind", text: "beyond taking a tag off a belt." },
              { lead: "Tagged means pass.", text: "Three seconds, about three strides." },
              {
                lead: "A knock on is not an offence at U7.",
                text: "Play carries on. This is the one that surprises people.",
              },
              {
                lead: "Nobody dives.",
                text: "Not to score, not to pick the ball up off the floor.",
              },
            ],
          },
        ],
      },
      {
        heading: "The numbers",
        blocks: [
          {
            table: {
              caption:
                "Maximums. A referee and both coaches can agree something smaller if it is " +
                "safer.",
              head: ["", "U7"],
              rows: [
                ["Players a side", "4"],
                ["Pitch", "20m x 12m, plus 5m of in-goal each end"],
                ["Ball", "Size 3"],
                ["Each half", "10 minutes"],
                ["Free pass", "Opposition 3 metres back"],
                ["Tackle", "None"],
                ["Scrum, lineout, kicking", "None"],
              ],
            },
          },
          {
            text:
              "Adjacent pitches should be no closer than 5 metres apart, which is worth knowing " +
              "if your club runs four games side by side on one set of pitches.",
          },
        ],
      },
      {
        heading: "The tag",
        blocks: [
          {
            text:
              "Every player wears a belt with two tags on it, one over each hip, Velcroed on. " +
              "Belts go outside the shirt and any spare belt gets tucked away so it cannot be " +
              "grabbed. Tags sit on the hips rather than the front or the back. They have to " +
              "stand out against the kit as well, so no red tags on a red shirt.",
          },
          {
            text:
              "A tag is the removal of one or both tags from the carrier's belt. Only the " +
              "carrier can be tagged. They may run and dodge but they cannot fend anybody off " +
              "with a hand or the ball, nor guard or shield their tags. Nobody may pull the " +
              "ball out of their hands at any point.",
          },
          {
            text:
              "If a player has lost a tag and carries on without both of them, they give away a " +
              "free pass the moment they carry the ball or tag somebody.",
          },
          { subheading: "What the carrier does" },
          {
            items: [
              { text: "Pass within three seconds of being tagged" },
              {
                text:
                  "Stop as soon as they can, within about three strides. The ball can go while " +
                  "they are stopping",
              },
              { text: "Go to the tagger, take the tag back, put it on the belt, then rejoin" },
              { text: "One step only to score once they have been tagged" },
            ],
          },
          { subheading: "What the tagger does" },
          {
            items: [
              {
                text:
                  "Stop running, hold the tag above their head and shout \"Tag\". The referee " +
                  "then calls \"Tag, pass\"",
              },
              {
                text:
                  "If the carrier stopped within a metre, retire a metre towards their own line " +
                  "to make room for the pass",
              },
              {
                text:
                  "Hand the tag back before rejoining. Playing on with somebody else's tag in " +
                  "your fist is a free pass against you",
              },
            ],
          },
          {
            text:
              "That last one is the bit seven-year-olds find hardest. Half your first month is " +
              "spent on giving the tag back rather than sprinting off with it like a trophy.",
          },
        ],
      },
      {
        heading: "Scoring",
        blocks: [
          {
            text:
              "Ground the ball on or over the line. Nobody may dive over: a dive is disallowed " +
              "and the defending side gets a free pass 3 metres out. Grounding it on their " +
              "knees does count, though you remind them afterwards to stay on their feet. " +
              "Nobody may stop a try by physical contact, including sticking a hand between the " +
              "ball and the grass.",
          },
          {
            text:
              "If a player is tagged while standing in the in-goal area they have to ground it " +
              "straight away to score. A good referee will say so out loud.",
          },
        ],
      },
      {
        heading: "Free passes",
        blocks: [
          {
            text:
              "A free pass restarts everything at U7: the start of each half, after a try, the " +
              "ball going into touch, any infringement, the ball being pulled out of somebody's " +
              "hands. The opposition stand 3 metres back and cannot move until the ball leaves " +
              "the passer's hands.",
          },
          {
            text:
              "The passer starts with the ball in both hands, waits for the referee to call " +
              "\"Play\", then passes backwards through the air. Nobody on either team runs until " +
              "the pass is made. A free pass is never marked within 3 metres of a goal line, so " +
              "both teams have room.",
          },
        ],
      },
      {
        heading: "What is not allowed",
        blocks: [
          {
            items: [
              {
                text:
                  "Tackling or any contact beyond taking a tag. Shirt pulling, barging, running " +
                  "in front of the carrier or shepherding them into touch are all a free pass",
              },
              { text: "Kicking of any kind" },
              { text: "A hand off or a fend" },
              { text: "Pulling the ball out of the carrier's hands" },
              { text: "Handing the ball to a teammate. It goes through the air or not at all" },
              { text: "Diving on a loose ball" },
            ],
          },
          {
            text:
              "Offside only happens at the tag. The line runs through the middle of the ball, " +
              "or a metre further back if you are the tagger. Everybody on the tagging side " +
              "heads back towards their own line until they are behind the ball.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "Catching a size 3 ball.",
                text: "Most of them cannot yet. Everything else waits on this",
              },
              {
                lead: "Passing backwards through the air.",
                text:
                  "Handing it over is a free pass and it is the instinct every one of them " +
                  "arrives with",
              },
              {
                lead: "Looking up while running.",
                text: "Twenty metres is not far, so a head-down runner meets a tagger immediately",
              },
              {
                lead: "Giving the tag back.",
                text:
                  "Put it in a game rather than explaining it. They learn it in a fortnight and " +
                  "never lose it",
              },
              {
                lead: "Stopping.",
                text:
                  "Three strides is a real skill at this age and it is what keeps the three " +
                  "second count honest",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "How many players are in a U7 rugby team?",
        answer:
          "Four a side on the pitch at once. Both teams have to field the same number. Rolling " +
          "substitutions are unlimited, so long as the ball is dead and the referee has said " +
          "yes. A substituted player can come back on later.",
      },
      {
        question: "Is there any contact in U7 rugby?",
        answer:
          "None beyond taking a tag off a belt. Shirt pulling, barging, running in front of the " +
          "carrier or forcing them into touch are all a free pass against you. So is a hand off " +
          "or a fend. The ball may not even be pulled out of the carrier's hands.",
      },
      {
        question: "What happens when a U7 player is tagged?",
        answer:
          "They have three seconds to pass and about three strides to stop in. The ball can go " +
          "while they are stopping. Then they collect their tag from the tagger, put it back on " +
          "the belt and rejoin play. Carrying on without it is a free pass against them.",
      },
      {
        question: "Can U7s score by diving over the line?",
        answer:
          "No. A dive is disallowed and the defending team gets a free pass 3 metres out. " +
          "Grounding it on their knees does count, though you remind them afterwards that they " +
          "are meant to stay on their feet.",
      },
      {
        question: "How big is a U7 rugby pitch?",
        answer:
          "20 metres by 12, plus 5 metres of in-goal at each end. That is the maximum rather " +
          "than a fixed size, so the referee and both coaches can agree something smaller if " +
          "they think it is safer.",
      },
    ],
  },
  u8: {
    ageGroup: "u8",
    title: "What changes at U8",
    standfirst:
      "Still tag, still no contact. What changes is the size of everything: six a side on a " +
      "pitch more than four times the U7 one, with a turnover rule that makes them pass before " +
      "they are made to. Here is the lot in plain English.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "The tag works exactly as it did last year, so nothing your squad learned goes to " +
              "waste. Everything around it grows.",
          },
          {
            items: [
              {
                lead: "Six a side",
                text: "rather than four, on 45 metres by 22 rather than 20 by 12.",
              },
              {
                lead: "The six tag turnover.",
                text: "Seven tags and the ball goes to the other team.",
              },
              {
                lead: "They may go to ground to score now.",
                text: "A dive over the line was disallowed at U7.",
              },
              {
                lead: "A knock on is an offence.",
                text: "At U7 an accidental knock forward was simply played on.",
              },
              { lead: "Free passes push the opposition 7 metres back", text: "rather than 3." },
            ],
          },
        ],
      },
      {
        heading: "U7 against U8, side by side",
        blocks: [
          {
            table: {
              caption:
                "Maximums. A referee and both coaches can agree a smaller pitch if it is safer.",
              head: ["", "U7", "U8"],
              rows: [
                ["Players a side", "4", "6"],
                ["Pitch", "20m x 12m", "45m x 22m"],
                ["Ball", "Size 3", "Size 3"],
                ["Each half", "10 minutes", "10 minutes"],
                ["Free pass", "Opposition 3m back", "Opposition 7m back"],
                ["Tag turnover", "None", "On the 7th tag"],
                ["Going to ground to score", "Not allowed", "Allowed"],
                ["Knock on", "Play continues", "Free pass"],
                ["Tackle, scrum, lineout, kicking", "None", "None"],
              ],
            },
          },
        ],
      },
      {
        heading: "The six tag turnover",
        blocks: [
          {
            text:
              "This is the rule that makes U8 a different game to coach. A team in possession " +
              "may be tagged six times. On the seventh the referee stops play and gives a free " +
              "pass to the other side, at the spot the tag happened. If that seventh tag comes " +
              "a step from the line and they ground it anyway, the try is disallowed and the " +
              "defending team gets a free pass 7 metres out.",
          },
          {
            text:
              "Both coaches can agree a lower number before kick off if they want to stretch a " +
              "strong squad. If you cannot agree, it is seven.",
          },
          {
            text:
              "The point of it is to stop one quick child running the ball up six times on " +
              "their own. It rewards a side that passes before it has to, which is the whole of " +
              "U8 coaching in one sentence.",
          },
        ],
      },
      {
        heading: "The bigger pitch",
        blocks: [
          {
            text:
              "45 metres by 22, plus 5 metres of in-goal at each end. That is more than four " +
              "times the playing area they had at U7 with only two more players on it, so the " +
              "change your squad will feel is space. Support runners have to work harder to be " +
              "anywhere useful. A defence that all chases the ball gets picked apart on the " +
              "outside.",
          },
          { text: "Adjacent pitches should be no closer than 5 metres apart." },
        ],
      },
      {
        heading: "The tag, unchanged",
        blocks: [
          {
            text:
              "Belt outside the shirt, two tags on the hips, spare belt tucked away. Only the " +
              "carrier can be tagged. They may run and dodge but cannot fend off with a hand or " +
              "the ball, nor guard their tags. Nobody may pull the ball from their hands.",
          },
          {
            items: [
              {
                text: "Tagged means pass within three seconds, stopping within about three strides",
              },
              {
                text:
                  "The carrier collects their tag from the tagger and puts it back on before " +
                  "rejoining",
              },
              { text: "One step only to score after being tagged" },
              {
                text:
                  "The tagger stops, holds the tag up and shouts \"Tag\". The referee calls \"Tag, " +
                  "pass\"",
              },
              {
                text:
                  "The tagger retires a metre if the carrier stopped that close, then hands the " +
                  "tag back before rejoining",
              },
            ],
          },
        ],
      },
      {
        heading: "Scoring, plus the corner nobody knows",
        blocks: [
          {
            text:
              "They are allowed to go to ground to score now, which is new. They still may not " +
              "dive on a loose ball anywhere else on the pitch.",
          },
          {
            text:
              "Then there is the set of rules about a ball on the ground over a goal line, " +
              "which comes up twice a season and stops everyone dead when it does:",
          },
          {
            items: [
              {
                text:
                  "Drop it over your own line and the opposition ground it, that is a try to " +
                  "them",
              },
              {
                text:
                  "Drop it over your own line and ground it yourself, free pass to the " +
                  "attacking side 7 metres out",
              },
              {
                text:
                  "Knock it forward over the line with no advantage to the other team, free " +
                  "pass to the defending side 7 metres out",
              },
              { text: "Take it back over the line yourself and ground it, that is a try" },
            ],
          },
          {
            text:
              "Nobody expects you to have that memorised. It is here so you can look it up on " +
              "the Sunday it happens.",
          },
        ],
      },
      {
        heading: "What is not allowed",
        blocks: [
          {
            items: [
              {
                text:
                  "Tackling or any contact beyond taking a tag. Shirt pulling, barging, running " +
                  "in front of the carrier or shepherding them into touch are all a free pass",
              },
              { text: "Kicking of any kind" },
              { text: "A hand off or a fend" },
              { text: "Pulling the ball out of the carrier's hands" },
              { text: "Handing the ball to a teammate. It goes through the air" },
              { text: "Diving on a loose ball" },
            ],
          },
          {
            text:
              "Offside still only happens at the tag, on a line through the middle of the ball, " +
              "or a metre further back if you are the tagger.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "Passing before the tag rather than after it.",
                text: "The six tag rule punishes a side that waits to be told",
              },
              {
                lead: "Support on both sides of the carrier.",
                text: "Two more players and four times the grass means a lone runner has nobody",
              },
              {
                lead: "Width in defence.",
                text: "Six chasing one ball is how sides concede all season at U8",
              },
              {
                lead: "Catching under a bit of pressure.",
                text: "They can catch standing still by now. Moving is the next thing",
              },
              {
                lead: "Counting the tags out loud.",
                text: "Do it in training games and they start looking up on four",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What is different about U8 rugby compared to U7?",
        answer:
          "Six a side rather than four, on a pitch more than four times the size. The six tag " +
          "turnover comes in, a knock on becomes an offence and they are allowed to go to " +
          "ground to score. The tag itself works exactly as it did.",
      },
      {
        question: "How many tags can a U8 team take before losing the ball?",
        answer:
          "Six. On the seventh the referee stops play and gives a free pass to the other team " +
          "where the tag happened. Both coaches can agree a lower number before kick off if " +
          "they want to make it harder for a strong squad.",
      },
      {
        question: "How big is a U8 rugby pitch?",
        answer:
          "45 metres by 22, plus 5 metres of in-goal at each end. That is roughly four times " +
          "the U7 pitch, which is the change your squad will feel most on the first Sunday.",
      },
      {
        question: "Can U8s tackle?",
        answer:
          "No. U8 is the second year of tag and the tackle does not arrive until U9. The only " +
          "contact allowed between the teams is taking a tag off a belt.",
      },
      {
        question: "Can a U8 player dive to score?",
        answer:
          "Yes. Going to ground to score is one of the few things U8 allows that U7 does not. " +
          "They still may not dive on a loose ball anywhere else on the pitch.",
      },
    ],
  },
  u9: {
    ageGroup: "u9",
    title: "What changes at U9",
    standfirst:
      "The belts come off and the tackle arrives. It is the biggest single step in minis rugby " +
      "and the one most coaches turn up to wondering whether they are qualified for it. Here is " +
      "exactly what U9 allows, in plain English.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "One thing arrives. It happens to be the thing the whole sport is built on, so it " +
              "takes the season.",
          },
          {
            items: [
              {
                lead: "The tackle.",
                text: "Held by an opponent and brought to ground, arms used.",
              },
              {
                lead: "No contest for the ball at all.",
                text:
                  "A defender may not grab at it or block the pass. This is the bit people get " +
                  "wrong.",
              },
              {
                lead: "No ruck, no maul, no scrum, no lineout.",
                text: "All of that is next year or later.",
              },
              {
                lead: "Seven a side",
                text: "on a longer pitch, with 15 minute halves rather than 10.",
              },
              {
                lead: "The six tackle turnover is optional now",
                text: "rather than standard. Both coaches plus the referee have to agree it.",
              },
            ],
          },
        ],
      },
      {
        heading: "U8 against U9, side by side",
        blocks: [
          {
            table: {
              caption:
                "Maximums. A referee and both coaches can agree a smaller pitch if it is safer.",
              head: ["", "U8", "U9"],
              rows: [
                ["Players a side", "6", "7"],
                ["Pitch", "45m x 22m", "60m x 30m"],
                ["Ball", "Size 3", "Size 3"],
                ["Each half", "10 minutes", "15 minutes"],
                ["Contact", "Taking a tag", "The tackle"],
                ["Contest for the ball", "None", "None"],
                ["Turnover count", "7th tag, always", "7th tackle, only if agreed"],
                ["Ruck, maul, scrum, lineout", "None", "None"],
                ["Kicking", "None", "None"],
              ],
            },
          },
        ],
      },
      {
        heading: "What counts as a tackle",
        blocks: [
          {
            text:
              "The carrier is held by one or more opponents and brought to ground. Arms have to " +
              "be used. A carrier who is not held has not been tackled, whatever it looked " +
              "like.",
          },
          {
            text:
              "The tackler grips and holds below the base of the sternum, which the RFU spells " +
              "out as the tummy or belly or below. The carrier must not go into contact with " +
              "their shoulders below their hips, dip down late and low, or put their head into " +
              "an opponent's head space. Contact above the sternum stops the game, the offender " +
              "gets spoken to and the other side gets a free pass.",
          },
          { subheading: "When the carrier stays on their feet" },
          {
            text:
              "The referee allows roughly three seconds to see whether they are genuinely held, " +
              "then calls \"Tackle\". From that call the carrier has three seconds to pass to a " +
              "teammate, standing or off the ground. They can keep going forward while they do " +
              "it.",
          },
          {
            text:
              "Once \"Tackle\" has been called they cannot score. Inside a metre of the line the " +
              "referee should let the three seconds run before calling, so a try that was there " +
              "is still there. If they were never held for three seconds and no call came, they " +
              "can score or place the ball over the line in one movement.",
          },
          { subheading: "When the carrier goes to ground" },
          {
            text:
              "The referee calls \"Tackle-Release\". The tackler releases straight away, gets to " +
              "their feet as soon as they can, does not touch the ball, does not block the pass " +
              "and gets back onside between their own goal line and the tackled player.",
          },
        ],
      },
      {
        heading: "The thing nobody expects: no contest",
        blocks: [
          {
            text:
              "At U9 the tackler may not contest the ball. No grabbing at it, no blocking the " +
              "pass. They may hold on to stop the carrier gaining more ground, but the moment " +
              "the pass is made they release and rejoin. More than one defender can be in the " +
              "tackle. None of them may stop the carrier passing.",
          },
          {
            text:
              "So possession does not change hands in contact at U9 at all. It changes hands on " +
              "a knock on, a forward pass or an infringement. That is the single biggest " +
              "difference between this grade and the next one. It is also why a U9 tackle drill " +
              "that carries on into a scramble on the floor has quietly become a U10 ruck " +
              "drill.",
          },
          { subheading: "What the carrier's own team may do" },
          {
            items: [
              {
                text:
                  "A teammate may rip the ball from their own carrier, then has to pass it " +
                  "immediately",
              },
              {
                text:
                  "A teammate may pick the ball up off a tackled player or off the ground, then " +
                  "has to pass it immediately. That player cannot be tackled",
              },
              { text: "Anyone passed the ball before, during or after contact may run with it" },
              { text: "Nobody may drive the carrier forward with a shoulder or by binding on" },
              { text: "Nobody may stand either side of the carrier to keep the next tackler off" },
            ],
          },
        ],
      },
      {
        heading: "Offside",
        blocks: [
          {
            text:
              "At the tackle, opponents stay a metre behind the hindmost foot of the hindmost " +
              "player. They retreat and stay behind that line, or behind their own goal line if " +
              "it is closer, until the pass is made. Away from the tackle, offside works as it " +
              "did at U8.",
          },
        ],
      },
      {
        heading: "What has not changed",
        blocks: [
          {
            items: [
              {
                text: "No kicking of any kind. No fly hacking a loose ball along the ground either",
              },
              {
                text:
                  "No scrum. A forward pass or a knock on is a free pass, the same as last year",
              },
              {
                text:
                  "No lineout. Touch restarts with a free pass 5 metres in, other side 7 metres " +
                  "back, nobody running until the pass is made",
              },
              { text: "No hand off, no fend, with either the hand or the ball" },
              { text: "The ball may not be pulled out of the carrier's hands by an opponent" },
              {
                text:
                  "No sin bin. The referee has a word with you on the touchline and the sides " +
                  "stay even",
              },
              {
                text: "Rolling subs, unlimited, whenever the ball is dead and the referee says so",
              },
              {
                text:
                  "The Half Game Rule applies, so every player gets at least half of the " +
                  "playing time. Across a festival that means half of the morning rather " +
                  "than half of each game",
              },
            ],
          },
          {
            text:
              "That last one is the one clubs get wrong most often. Match day works the " +
              "rotations out for you on the touchline, so nobody has to count it on the back of " +
              "a team sheet.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "Falling over safely.",
                text:
                  "Before any of them tackle anybody. Getting to ground and back up is a skill " +
                  "and it is week one",
              },
              {
                lead: "Where the shoulder goes.",
                text:
                  "Cheek to cheek, head on the safe side, eyes open. Taught slowly, from " +
                  "kneeling, with nobody moving fast",
              },
              {
                lead: "Below the sternum, every time.",
                text: "Say the height out loud in every drill until they stop thinking about it",
              },
              {
                lead: "Passing off the floor.",
                text: "Three seconds is not long and most of them have never done it",
              },
              {
                lead: "Getting up and rejoining.",
                text: "The tackler's job is not finished when the tackle is",
              },
              {
                lead: "Keep the handling going.",
                text:
                  "It is still a passing game. A squad that spends all winter on contact cannot " +
                  "move a ball in March",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What is different about U9 rugby compared to U8?",
        answer:
          "The tag belts go and the tackle arrives, which is the biggest single step in minis " +
          "rugby. Seven a side rather than six, on a longer pitch, with 15 minute halves rather " +
          "than 10. There is still no ruck, no maul, no scrum and no lineout.",
      },
      {
        question: "Can U9s ruck?",
        answer:
          "No. U9 is tackle only. Once the carrier is down the ball comes back to their own " +
          "side every time, because a defender may not grab at it or block the pass. Rucks and " +
          "mauls arrive at U10.",
      },
      {
        question: "What is a legal tackle at U9?",
        answer:
          "Grip and hold below the base of the sternum, so the tummy or belly or below, using " +
          "the arms. The carrier must not go into contact with their shoulders below their " +
          "hips, dip down late and low, or put their head into an opponent's head space. " +
          "Contact above the sternum stops the game.",
      },
      {
        question: "What happens when a U9 ball carrier stays on their feet?",
        answer:
          "The referee allows about three seconds to see whether they are properly held, then " +
          "calls \"Tackle\". From that call they have three seconds to pass. They can keep going " +
          "forward while they do it, but they cannot score once the call has been made.",
      },
      {
        question: "Do U9s have the six tackle rule?",
        answer:
          "Only if both coaches and the referee agree it before kick off. Regulation 15 lists " +
          "it as a transitional variation for squads that are ready rather than as standard. At " +
          "U8 the equivalent tag rule applies to everybody.",
      },
    ],
  },
  u10: {
    ageGroup: "u10",
    title: "What changes at U10",
    standfirst:
      "Your squad has had a season of tackling. U10 hands them the ruck, the maul and a three " +
      "player scrum in one go, on a wider pitch with a bigger ball. Here is the lot in plain " +
      "English before your first Tuesday.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "At U9 nobody could compete for the ball. A defender who grabbed at it gave away " +
              "a free pass. Once the carrier was down the ball came back to their own side " +
              "every time. That is the thing that goes at U10. The RFU's own summary of the " +
              "grade puts it as a contest for the ball of one player against one player, which " +
              "is a small phrase for quite a large change.",
          },
          {
            items: [
              {
                lead: "Rucks arrive.",
                text:
                  "Capped at two players from either team, counting the ball carrier and the " +
                  "opponent.",
              },
              { lead: "Mauls arrive.", text: "Same cap of two a side." },
              {
                lead: "The scrum arrives.",
                text: "Three players, the nearest three to the stoppage, nobody pushing.",
              },
              {
                lead: "A knock on is now a scrum",
                text:
                  "rather than a free pass, which is the change your referee will use most " +
                  "often.",
              },
              { lead: "Eight a side", text: "on a wider pitch, with a size 4 ball." },
            ],
          },
        ],
      },
      {
        heading: "U9 against U10, side by side",
        blocks: [
          {
            table: {
              caption:
                "Maximum figures. A referee and both coaches can agree a smaller pitch if it is " +
                "safer.",
              head: ["", "U9", "U10"],
              rows: [
                ["Players a side", "7", "8"],
                ["Pitch", "60m x 30m", "60m x 35m"],
                ["Ball", "Size 3", "Size 4"],
                ["Each half", "15 minutes", "15 minutes"],
                ["Scrum", "None", "3 players, uncontested"],
                ["Ruck", "None", "2 players a side"],
                ["Maul", "None", "2 players a side"],
                ["Contest for the ball", "None", "1 against 1"],
                ["Knock on", "Free pass", "Scrum"],
                ["Lineout", "None", "None"],
                ["Kicking", "None", "None"],
                ["Hand off", "None", "None"],
              ],
            },
          },
        ],
      },
      {
        heading: "The contest for the ball",
        blocks: [
          {
            text:
              "This is the part worth reading twice, because it is where your Sunday mornings " +
              "will be won or lost and it is the part nobody explains properly at the start of " +
              "the season.",
          },
          { subheading: "What a ruck is at U10" },
          {
            text:
              "The ball is on the ground and players from both sides, on their feet, close " +
              "around it. Open play has ended. No more than two players from either team can be " +
              "involved. That count includes the ball carrier and the opponent, so it stays " +
              "small on purpose.",
          },
          {
            text:
              "Once a team has clearly won the ball the referee calls \"Use it\" and you have " +
              "five seconds to play it. Miss that and it is a free pass to the other side.",
          },
          {
            text:
              "When the tackle has been made and the carrier is on the ground, one supporting " +
              "player from each team, who has to stay on their feet, may do one of four things:",
          },
          {
            items: [
              { text: "Rip the ball and pass it immediately" },
              { text: "Pick it up and pass it away from the contact" },
              { text: "Pick it up and run, but only if no ruck has formed" },
              { text: "Join to form a ruck from their own side and drive over the ball" },
            ],
          },
          {
            text:
              "If somebody has driven over the ball like that, the next player to arrive has to " +
              "pass it. Nobody gets to set up camp.",
          },
          { subheading: "What a maul is at U10" },
          {
            text:
              "A maul starts when the carrier is held up by one or two opponents and one of " +
              "their own team binds onto them. That is three players minimum, all on their " +
              "feet, all moving towards a goal line. The same cap applies: no more than two " +
              "from either team, counting the carrier and the opponent. Five seconds once it is " +
              "formed, then the ball moves or the other side gets a free pass.",
          },
          { subheading: "The bit that catches sides out" },
          {
            text:
              "When the carrier is held but still upright and has stopped going forward, the " +
              "ball has to be played away from the contact area. It is not a three second count " +
              "and there is no shout to wait for. If the ball stays in there, it is a free pass " +
              "against you. Half a squad's first month at U10 is spent learning to move it " +
              "before somebody tells them to.",
          },
        ],
      },
      {
        heading: "The scrum",
        blocks: [
          {
            text:
              "Three players a side, a prop either side of the hooker. They are simply the " +
              "nearest three to the stoppage. The fourth nearest becomes the scrum half. The " +
              "RFU's phrase for it is \"all players trained, late specialisation\", which in " +
              "practice means everyone in your squad ends up in there at some point over a " +
              "season. That is deliberate.",
          },
          {
            items: [
              {
                text:
                  "The referee calls \"Crouch\", then \"Bind\", then \"Set\". Each prop binds onto " +
                  "the back or side of their opposite number with the outside arm",
              },
              { text: "Nobody pushes. Only the team throwing in may strike for the ball" },
              {
                text:
                  "No charging in. Heads and shoulders never below the hips, no downward " +
                  "pressure",
              },
              { text: "The scrum half passes from the base of the scrum and must not run with it" },
              {
                text:
                  "The defending scrum half stays directly behind their own scrum, in the " +
                  "pocket between the two props",
              },
              { text: "Both back lines stay 5 metres behind until the ball is out" },
              {
                text:
                  "A scrum awarded inside the 5 metre line gets moved out, so the middle of it " +
                  "sits 5 metres from the goal line",
              },
            ],
          },
          {
            text:
              "If a scrum collapses the whistle goes immediately. A player who keeps collapsing " +
              "it or binding illegally takes no further part in the scrum. One whose technique " +
              "or strength makes them a danger gets replaced. Every player who goes in there, " +
              "replacements included, should have been trained for it.",
          },
        ],
      },
      {
        heading: "What is different about the tackle",
        blocks: [
          {
            text:
              "Most of it is last season's work and the safety lines have not moved. Contact " +
              "stays below the base of the sternum, so tummy or below. The carrier still must " +
              "not go in with shoulders below the hips, dip down late and low, or put their " +
              "head into an opponent's head space. What is new is everything either side of the " +
              "contact.",
          },
          {
            items: [
              {
                text:
                  "When the carrier has not been taken to ground, an opponent may grab the " +
                  "ball. At U9 that was a free pass against them",
              },
              {
                text:
                  "The tackler has to release the carrier and get back on their feet before " +
                  "touching the ball or blocking a pass",
              },
              {
                text:
                  "On \"Tackle-Release\" the carrier passes immediately, rolls away or places the " +
                  "ball back towards their own team",
              },
              { text: "The team in possession supports from behind only" },
              {
                text:
                  "Support players still cannot stand either side of the carrier to keep " +
                  "defenders off",
              },
              {
                text:
                  "The six tackle turnover that some U9 sides moved on to is gone. Possession " +
                  "changes hands at the breakdown now",
              },
            ],
          },
          {
            text:
              "Offside is worth a mention too. At U9 it only really happened at the tackle. At " +
              "U10 there is an offside line at the tackle, the ruck and the maul. It is the " +
              "hindmost foot or hindmost point of the players involved. Defenders stay between " +
              "their own goal line and the tackled player until the pass is made.",
          },
        ],
      },
      {
        heading: "What has not changed",
        blocks: [
          {
            items: [
              {
                text: "No kicking of any kind. No fly hacking a loose ball along the ground either",
              },
              {
                text:
                  "No lineout. Touch restarts with a free pass 5 metres in, level with where it " +
                  "went out, other side 7 metres back, nobody running until the pass is made",
              },
              { text: "No hand off, no fend, with either the hand or the ball" },
              {
                text:
                  "Free passes rather than penalty kicks. The passer starts with the ball in " +
                  "both hands and passes backwards through the air on \"Play\"",
              },
              {
                text:
                  "No sin bin. The referee has a word with you on the touchline and the sides " +
                  "stay even",
              },
              { text: "Squeezeball is out. No coach may teach it either" },
              {
                text:
                  "Rolling subs, as many as you like, whenever the ball is dead and the referee " +
                  "says so",
              },
              {
                text:
                  "The Half Game Rule applies, so every player gets at least half of the " +
                  "playing time. Across a festival that means half of the morning rather " +
                  "than half of each game",
              },
            ],
          },
          {
            text:
              "That last one is the one clubs get wrong most often. Match day works the " +
              "rotations out for you on the touchline, so nobody has to count it on the back of " +
              "a team sheet.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "Ball placement.",
                text:
                  "Long arms, ball back towards your own side, then get up. This is the single " +
                  "highest value thing you will teach all year",
              },
              {
                lead: "Getting to your feet.",
                text:
                  "The tackler has to release and stand up before they can touch the ball " +
                  "again. Most U10 free passes are somebody who did not",
              },
              {
                lead: "Arriving from your own side.",
                text:
                  "On your feet, over the ball, from the direction of your own goal line. That " +
                  "plus the point above covers the bulk of your penalty count",
              },
              {
                lead: "The five second habit.",
                text:
                  "A squad that has never heard \"Use it\" will freeze the first time, so put it " +
                  "in your training games from week one",
              },
              {
                lead: "Scrum shape with nobody pushing.",
                text:
                  "Duller than they want it to be. It is also the bit that keeps necks safe, so " +
                  "it gets its own slot",
              },
              {
                lead: "Keep the handling going.",
                text: "A squad that only rucks all winter cannot move a ball come March",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Is the ruck contested at U10?",
        answer:
          "Yes, but it is capped. The RFU describes U10 as a contest for the ball of one player " +
          "against one player. No more than two players from either team can be involved in a " +
          "ruck. That count includes the ball carrier and the opponent, so a third body piling " +
          "in gives away a free pass.",
      },
      {
        question: "How many players are in an U10 scrum?",
        answer:
          "Three a side. They are just the three nearest players to the stoppage rather than " +
          "three specialists. The fourth nearest acts as scrum half. Nobody pushes and only the " +
          "team throwing in may strike for the ball, so it is a way of restarting play rather " +
          "than a contest.",
      },
      {
        question: "Do U10s have a lineout?",
        answer:
          "No. Play restarts with a free pass 5 metres in from touch, level with where the ball " +
          "went out, with the other side 7 metres back. There is none at U11 or U12 either. The " +
          "lineout arrives at U14.",
      },
      {
        question: "Can U10s kick the ball?",
        answer:
          "No. Kicking of any kind is out at U10. So is fly hacking a loose ball along the " +
          "ground. Kicking from hand comes in at U11, which is why U11 coaches spend September " +
          "explaining catching to parents.",
      },
      {
        question: "Can U10s hand off?",
        answer:
          "No. A fend or hand off with the hand or the ball is a free pass at U10. The hand off " +
          "comes in at U12, below the armpits.",
      },
      {
        question: "What is the biggest change from U9 to U10?",
        answer:
          "The ball becomes contestable. At U9 a defender who grabbed at it gave away a free " +
          "pass. At U10 an opponent can grab it, rucks and mauls exist and a knock on brings a " +
          "scrum, so possession changes hands in ways your squad has never had to deal with.",
      },
    ],
  },
  u11: {
    ageGroup: "u11",
    title: "What changes at U11",
    standfirst:
      "The boot arrives. After four seasons of no kicking whatsoever, U11 hands them tactical " +
      "kicking from hand plus drop kick restarts, on a wider pitch with longer halves. The " +
      "contest at the breakdown doubles too. Here is the lot in plain English.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "U10 was the year the game got physical. U11 is the year it gets long. Everything " +
              "stretches: the pitch, the halves, the distance the ball can travel in one go.",
          },
          {
            items: [
              {
                lead: "Kicking from hand.",
                text:
                  "Tactical kicking is in, restarts are drop kicks. No conversions, no box " +
                  "kicks, no drop goals.",
              },
              {
                lead: "The ruck and maul go to three a side",
                text: "from two, so the contest is two against two.",
              },
              {
                lead: "Both hookers may strike",
                text: "at the scrum. It is still three players and still nobody pushing.",
              },
              {
                lead: "Nine a side",
                text: "on 60 by 43, which is half a full pitch, with 20 minute halves.",
              },
              {
                lead: "Free kicks replace free passes",
                text:
                  "for the serious offences. Missing the five second call is now a scrum rather " +
                  "than a free pass.",
              },
            ],
          },
        ],
      },
      {
        heading: "U10 against U11, side by side",
        blocks: [
          {
            table: {
              caption:
                "Maximums. A referee and both coaches can agree a smaller pitch if it is safer.",
              head: ["", "U10", "U11"],
              rows: [
                ["Players a side", "8", "9"],
                ["Pitch", "60m x 35m", "60m x 43m, with a 15m zone"],
                ["Ball", "Size 4", "Size 4"],
                ["Each half", "15 minutes", "20 minutes"],
                ["Kicking", "None", "Tactical kicking from hand"],
                ["Restarts", "Free pass", "Drop kick, must travel 7m"],
                ["Ruck", "2 players a side", "3 players a side"],
                ["Maul", "2 players a side", "3 players a side"],
                ["Scrum", "3 players, one hooker strikes", "3 players, both hookers strike"],
                ["Missing the \"Use it\" call", "Free pass", "Scrum"],
                ["Lineout", "None", "None"],
                ["Hand off", "None", "None"],
              ],
            },
          },
        ],
      },
      {
        heading: "Kicking",
        blocks: [
          {
            text:
              "This is the change that defines the grade. It is also the one that will take up " +
              "your September.",
          },
          {
            items: [
              { text: "Tactical kicking from hand is allowed anywhere" },
              {
                text:
                  "Restarts are drop kicks. They have to travel 7 metres or the other side " +
                  "chooses between a re-kick or a scrum on halfway",
              },
              { text: "After a score the non-scoring side chooses whether to kick or receive" },
              { text: "No conversions, no box kicks, no drop goals" },
              { text: "Fly hacking a loose ball along the ground is still out" },
              {
                text:
                  "A mark can be called anywhere on the pitch from an open play kick, though " +
                  "not from a restart or a free kick. The catcher's team gets a free kick",
              },
              {
                text:
                  "Kick from outside the 15 metre zone straight into touch and the other side " +
                  "gets a free pass in line with where you kicked it, 5 metres in",
              },
            ],
          },
          { subheading: "The one that looks wrong to every parent" },
          {
            text:
              "If a player is trying to catch a kick in open play and knocks it forward, that " +
              "is not treated as a knock on. The team trying to catch it gets the scrum. Same " +
              "if they get a hand to it and it goes backwards with nobody gaining an advantage.",
          },
          {
            text:
              "This applies at U11 only. It exists because this is the first season of kicking " +
              "and the RFU would rather they had a go at catching than stood back and let it " +
              "bounce. Worth explaining to your touchline in week one, because it will come up " +
              "in week two.",
          },
        ],
      },
      {
        heading: "The breakdown",
        blocks: [
          {
            text:
              "The cap goes from two players a side to three, counting the ball carrier and the " +
              "opponent. The RFU's own summary calls it a contest of two players against two.",
          },
          {
            text:
              "When the tackle is made and the carrier is on the ground, two supporting players " +
              "from each team, on their feet, may rip and pass immediately, pick up and pass " +
              "away from the contact, pick up and run if no ruck has formed, or join to form a " +
              "ruck from their own side and drive over the ball. Up to two may join. If " +
              "somebody has driven over it, the next player to arrive has to pass it.",
          },
          {
            text:
              "A maul is the same cap of three a side. Once the ball is won the referee calls " +
              "\"Use it\" and there are five seconds to play it. Miss that and it is a scrum to " +
              "the other team now rather than a free pass, which is a meaningful upgrade in " +
              "what it costs you.",
          },
          {
            text:
              "Everything else about the tackle is as it was at U10: below the base of the " +
              "sternum, no shoulders below the hips, no dipping late and low, no head into an " +
              "opponent's head space. An opponent may still grab the ball when the carrier has " +
              "not been taken to ground. Ripped ball still has to be passed.",
          },
        ],
      },
      {
        heading: "The scrum",
        blocks: [
          {
            text:
              "Still three players, still the nearest three to the stoppage, still nobody " +
              "pushing. One thing changes and it changes the whole feel of it: both hookers may " +
              "contest and strike for the ball.",
          },
          {
            items: [
              { text: "Crouch, bind, set, as before" },
              { text: "The scrum half puts it in straight, from the middle of the gap" },
              { text: "The scrum half must pass it away. No running with it, no kicking it" },
              { text: "The defending scrum half stays behind their own scrum" },
              { text: "Both back lines stay 5 metres back" },
            ],
          },
          {
            text:
              "So the scrum stops being purely a restart and becomes a small contest. It is " +
              "worth a session of its own, because a hooker who has never struck for a ball " +
              "will not learn it on a Sunday.",
          },
        ],
      },
      {
        heading: "Free kicks",
        blocks: [
          {
            text:
              "Free passes give way to free kicks for the serious stuff: a fend or hand off, " +
              "foul play, offside, squeeze ball, diving off your feet, pushing in the scrum, a " +
              "high tackle. Opponents go back 7 metres.",
          },
          {
            text:
              "A free kick can be put into touch, but the free pass that follows always goes to " +
              "the other team. Where it is taken depends on where you kicked from: at the point " +
              "the ball crossed the line if it bounced out or if you kicked from inside your " +
              "own 15 metre area, in line with where you kicked it if it went straight out from " +
              "outside that area.",
          },
        ],
      },
      {
        heading: "What has not changed",
        blocks: [
          {
            items: [
              {
                text:
                  "No lineout. Touch restarts with a free pass 5 metres in, or a quick throw if " +
                  "the same ball has not been touched by anyone off the pitch",
              },
              { text: "No hand off, no fend" },
              { text: "The high tackle line is where it was, at the base of the sternum" },
              {
                text:
                  "No sin bin. The referee has a word with you on the touchline and the sides " +
                  "stay even",
              },
              { text: "Rolling subs, unlimited, whenever the ball is dead" },
              {
                text:
                  "The Half Game Rule applies, so every player gets at least half of the " +
                  "playing time. Across a festival that means half of the morning rather " +
                  "than half of each game",
              },
            ],
          },
          {
            text:
              "That last one is the one clubs get wrong most often. Match day works the " +
              "rotations out for you on the touchline, so nobody has to count it on the back of " +
              "a team sheet.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "Catching a high ball.",
                text:
                  "Nobody in your squad has ever had to. Start it in the first session and keep " +
                  "it in all year",
              },
              {
                lead: "Kicking to space rather than to nobody.",
                text:
                  "They will all want to boot it as far as they can. That is how you give the " +
                  "ball away",
              },
              { lead: "Chasing your own kick.", text: "A kick nobody chases is a gift" },
              {
                lead: "The second man at the ruck.",
                text: "The cap went up, so there is a job that did not exist last season",
              },
              {
                lead: "Hooker striking for the ball.",
                text: "Give more than one of them a go. Yours will be off with a cold in November",
              },
              {
                lead: "Playing what is in front of you.",
                text:
                  "A wider pitch with a kicking option is the first grade where a decision is " +
                  "worth more than a run",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What changes from U10 to U11?",
        answer:
          "Kicking from hand arrives, which is the big one. Nine a side on a wider pitch with " +
          "20 minute halves. Both hookers may strike at the scrum. The ruck and maul go from " +
          "two players a side to three.",
      },
      {
        question: "Can U11s kick the ball?",
        answer:
          "Yes. Tactical kicking from hand is in and restarts are drop kicks that have to " +
          "travel 7 metres. There are no conversions, no box kicks and no drop goals. Fly " +
          "hacking a loose ball along the ground is still out.",
      },
      {
        question: "How many players can be in a U11 ruck?",
        answer:
          "Three from each team, counting the ball carrier and the opponent, so it goes from " +
          "the one against one contest at U10 to two against two. Miss the five second call " +
          "after \"Use it\" and it is a scrum to the other side rather than a free pass.",
      },
      {
        question: "Why did the referee give a scrum when my player knocked the ball on?",
        answer:
          "If they were trying to catch a kick in open play, that is not treated as a knock on " +
          "at U11 and the catching team gets the scrum. It applies at U11 only, because it is " +
          "the first season of kicking and the RFU would rather they had a go at catching than " +
          "let it bounce.",
      },
      {
        question: "Can U11s have a lineout?",
        answer:
          "No. Touch restarts with a free pass 5 metres in, or a quick throw if the same ball " +
          "has not been touched by anyone off the pitch. The lineout arrives at U14.",
      },
    ],
  },
  u12: {
    ageGroup: "u12",
    title: "What changes at U12",
    standfirst:
      "The last year of minis. Twelve a side, a five player scrum, plus the caps coming off the " +
      "ruck and the maul for the first time. The hand off arrives too. Here is the lot in plain " +
      "English before your first Tuesday.",
    sections: [
      {
        heading: "The short version",
        blocks: [
          {
            text:
              "Nothing brand new turns up at U12. What happens is that the limits come off " +
              "things your squad already does, which makes it feel like a bigger jump than it " +
              "reads on paper.",
          },
          {
            items: [
              { lead: "Twelve a side", text: "rather than nine, on the same pitch." },
              { lead: "The scrum goes to five", text: "in a 3-2 shape. Still nobody pushing." },
              {
                lead: "No cap on the ruck or the maul.",
                text: "Normal laws apply for the first time.",
              },
              { lead: "The hand off arrives", text: ", below the armpit." },
              {
                lead: "Ripped ball can be run with",
                text: "rather than having to be passed immediately.",
              },
            ],
          },
        ],
      },
      {
        heading: "U11 against U12, side by side",
        blocks: [
          {
            table: {
              caption:
                "Maximums. A referee and both coaches can agree a smaller pitch if it is safer.",
              head: ["", "U11", "U12"],
              rows: [
                ["Players a side", "9", "12"],
                ["Pitch", "60m x 43m", "60m x 43m"],
                ["Ball", "Size 4", "Size 4"],
                ["Each half", "20 minutes", "20 minutes"],
                ["Scrum", "3 players", "5 players, in a 3-2"],
                ["Ruck", "3 players a side", "No limit"],
                ["Maul", "3 players a side", "No limit"],
                ["Ripped ball", "Must be passed", "Can be run or passed"],
                ["Hand off", "None", "Below the armpit"],
                ["Scrum half from a ruck", "Pass only", "Pass, or pick and go"],
                ["Lineout", "None", "None"],
                ["Pushing in the scrum", "None", "None"],
              ],
            },
          },
        ],
      },
      {
        heading: "The scrum",
        blocks: [
          {
            text:
              "Five players a side now, set up in a 3-2. They are the nearest five to the " +
              "stoppage rather than five specialists, which is the RFU keeping late " +
              "specialisation going right to the end of minis.",
          },
          {
            items: [
              { text: "Crouch, bind, set, as before" },
              { text: "Both hookers may strike for the ball" },
              {
                text:
                  "Nobody pushes. Pushing does not arrive until U13, where 1.5 metres is all of " +
                  "it",
              },
              { text: "The scrum half puts it in straight, from the middle of the gap" },
              {
                text: "The scrum half must pass it away. No picking it up and running, no kicking",
              },
              { text: "Both back lines stay 5 metres back" },
              { text: "The defending scrum half cannot follow round. They stay in the middle" },
            ],
          },
          {
            text:
              "Two in the second row is the genuinely new bit. It is a session on its own, " +
              "because the binding is different and there is nobody in your squad who has done " +
              "it.",
          },
        ],
      },
      {
        heading: "The breakdown, uncapped",
        blocks: [
          {
            text:
              "This is the change that alters how the game looks. Normal ruck and maul laws " +
              "apply, with no restriction on numbers at all.",
          },
          {
            items: [
              {
                text: "A ruck is at least one player from each side, on their feet, over the ball",
              },
              { text: "A maul is three players: the carrier plus one from each team" },
              { text: "No limit on who else joins either" },
              {
                text:
                  "The referee still calls \"Use it\" once the ball is won. Still five seconds. " +
                  "Miss it and it is a scrum to the other team",
              },
              { text: "The scrum half can pass or pick and go, though not box kick" },
              {
                text:
                  "Ripped ball can now be run with rather than having to be passed straight " +
                  "away",
              },
            ],
          },
          {
            text:
              "Four seasons of capped contests end here. A squad that has only ever seen one or " +
              "two bodies over the ball will find its first uncapped ruck a shock, so it is " +
              "worth building up to rather than switching on in a match.",
          },
        ],
      },
      {
        heading: "The hand off",
        blocks: [
          {
            text:
              "Permitted for the first time, below the armpit. Nothing above that: a hand off " +
              "to the head or the neck is foul play and always was.",
          },
          {
            text:
              "Every one of your players has spent four seasons being told a fend is a free " +
              "pass against them, so expect it to take a while to arrive. Expect it to arrive " +
              "too high at first, as well, which is worth heading off in training rather than " +
              "on a Sunday.",
          },
        ],
      },
      {
        heading: "Kicking",
        blocks: [
          {
            items: [
              { text: "Tactical kicking from hand, as at U11" },
              {
                text:
                  "Restarts are drop kicks and have to travel 7 metres. The 22 metre restarts " +
                  "follow adult law",
              },
              { text: "No conversions, no penalty kicks at goal, no box kicks, no drop goals" },
              {
                text:
                  "Anyone in front of the kicker is offside. They stay still, or retire if they " +
                  "are within 7 metres of where it lands",
              },
              { text: "Fly hacking a loose ball along the ground is still out" },
            ],
          },
        ],
      },
      {
        heading: "What has not changed",
        blocks: [
          {
            items: [
              {
                text:
                  "No lineout. Touch restarts with a free pass 5 metres in, or a quick throw if " +
                  "the same ball has not been touched by anyone off the pitch",
              },
              { text: "Nobody pushes in the scrum" },
              {
                text:
                  "The high tackle line is where it was, at the base of the sternum. No " +
                  "shoulders below the hips, no dipping late and low, no head into an " +
                  "opponent's head space",
              },
              {
                text:
                  "Free kicks for foul play, offside, squeeze ball, diving off your feet, " +
                  "pushing in the scrum, a high tackle. Opponents go back 7 metres",
              },
              {
                text:
                  "No sin bin. The referee has a word with you on the touchline and the sides " +
                  "stay even",
              },
              { text: "Rolling subs, unlimited, whenever the ball is dead" },
              {
                text:
                  "The Half Game Rule applies, so every player gets at least half of the " +
                  "playing time. Across a festival that means half of the morning rather " +
                  "than half of each game",
              },
            ],
          },
          {
            text:
              "That last one is the one clubs get wrong most often. Match day works the " +
              "rotations out for you on the touchline, so nobody has to count it on the back of " +
              "a team sheet.",
          },
        ],
      },
      {
        heading: "What to get in before the season starts",
        blocks: [
          {
            items: [
              {
                lead: "The five player scrum, slowly.",
                text:
                  "Two in the second row is new to everybody. Shape and binding, with nobody " +
                  "pushing",
              },
              {
                lead: "Arriving at an uncapped ruck.",
                text:
                  "Feet, from your own side, over the ball. The cap used to do this job for you",
              },
              {
                lead: "The jackal, legally.",
                text:
                  "On your feet, supporting your own weight. It changes more U12 games than any " +
                  "move you can draw",
              },
              {
                lead: "The hand off, low.",
                text:
                  "They will put it too high on the first go and every go after that until " +
                  "somebody says so",
              },
              {
                lead: "Moving the ball early.",
                text: "U13 punishes a squad that carries into contact every single time",
              },
              {
                lead: "Defence that holds its shape.",
                text: "Twelve a side on the same pitch means less room and more drift",
              },
            ],
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What changes from U11 to U12?",
        answer:
          "Twelve a side rather than nine. The scrum goes to five players in a 3-2 shape, the " +
          "caps come off the ruck and maul numbers, the hand off arrives below the armpits. The " +
          "pitch, the ball and the length of a half all stay as they were.",
      },
      {
        question: "How many players are in a U12 scrum?",
        answer:
          "Five a side in a 3-2 shape. They are the nearest five to the stoppage rather than " +
          "five specialists. Both hookers may strike. Nobody pushes, so it is shape and binding " +
          "rather than shoving. Pushing does not arrive until U13.",
      },
      {
        question: "Can U12s hand off?",
        answer:
          "Yes, below the armpit. U12 is the first grade that allows one at all. Anything " +
          "higher than that is foul play, so expect to spend a few sessions bringing it down.",
      },
      {
        question: "How many players can be in a U12 ruck?",
        answer:
          "There is no limit. Normal ruck and maul laws apply for the first time, so a ruck is " +
          "at least one player from each side on their feet over the ball. A maul is three " +
          "players: the carrier plus one from each team.",
      },
      {
        question: "Do U12s have a lineout?",
        answer:
          "No. Regulation 15 keeps touch restarting with a free pass all the way through U13. " +
          "The uncontested lineout arrives at U14 and lifting waits until U15, so an U12 night " +
          "spent on throwing is a night spent on something the referee will never ask for.",
      },
    ],
  },
};
