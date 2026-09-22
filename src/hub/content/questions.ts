import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  THEME_MIN_AGE,
  type AgeGroup,
  type Theme,
} from "./types.js";

/**
 * The questions a coach asks when something has just happened.
 *
 * The rules guides in `guides.ts` answer "what is my grade allowed to do",
 * which is the question somebody asks in August with a cup of tea. The
 * coaching guides in `coaching.ts` answer "how do I teach this". Neither
 * answers the one that gets asked in a car park at ten past eleven on a
 * Sunday: the ball came out the wrong side of the scrum, the referee gave a
 * scrum to the side that knocked it forward, somebody has taken a bang on the
 * head. Most of these had an answer somewhere here already. It sat at the foot
 * of a grade page where nobody scrolls, so nothing could find it.
 *
 * So this is the same words a third way round. Short question, short answer,
 * grouped by what was happening at the time rather than by grade. It is the
 * one shape of this content a coach can search.
 *
 * Deliberately not a chat box. An answer generated on the spot needs signal at
 * a wet pitch, cannot be held to Regulation 15 and cannot be read as a diff
 * before it ships. Every word below was written once and checked once, which
 * is what the rest of this catalogue does too.
 *
 * Like the guides, this is not age gated. See `questions.ts` in
 * `hub/views/` for why, plus the grade label every answer carries.
 *
 * Text is plain. No markup, no links, no HTML. Both renderers escape every
 * string, which is what lets this be edited without thinking about tags.
 */

/**
 * What was happening when the question came up.
 *
 * The key is the URL as well: a topic publishes at `/rugby-<topic>-questions`,
 * so "match-day" is hyphenated here rather than being carried in a second
 * property that could disagree with it.
 */
export const QUESTION_TOPICS = [
  "tag",
  "tackle",
  "ruck",
  "scrum",
  "restarts",
  "kicking",
  "match-day",
  "referee",
  "safety",
  "coaching",
] as const;

export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

export function isQuestionTopic(value: unknown): value is QuestionTopic {
  return typeof value === "string" && (QUESTION_TOPICS as readonly string[]).includes(value);
}

export interface TopicMeta {
  /** On a card and as the heading of its own page. */
  label: string;
  /** One line, so a coach can pick a topic without opening it. */
  blurb: string;
  /**
   * The phase of play this covers, where there is one.
   *
   * Only four topics have one. It is not used to hide anything: it is what
   * `questions.test.ts` checks a question's own `from` against, so a scrum
   * question can never claim to apply a grade earlier than Reg 15 brings the
   * scrum in. The same table the age gate itself runs on.
   */
  theme?: Theme;
}

export const TOPICS: Record<QuestionTopic, TopicMeta> = {
  tag: {
    label: "Tag rugby",
    blurb: "Tags, the three second count plus the six tag turnover. U7 and U8 only.",
  },
  tackle: {
    label: "The tackle",
    blurb: "How high, what counts as held plus what the tackler has to do next.",
    theme: "tackle",
  },
  ruck: {
    label: "Ruck and maul",
    blurb: "Who may join, what \"Use it\" means plus where the offside line sits.",
    theme: "breakdown",
  },
  scrum: {
    label: "The scrum",
    blurb: "Three players at U10, five at U12, nobody pushing at either.",
    theme: "setpiece",
  },
  restarts: {
    label: "Restarts and touch",
    blurb: "Free passes, free kicks plus why there is no lineout anywhere in minis.",
  },
  kicking: {
    label: "Kicking",
    blurb: "What the boot is allowed to do from U11, plus the U11 rule that looks wrong.",
    theme: "kicking",
  },
  "match-day": {
    label: "Match day",
    blurb: "The Half Game Rule, rolling subs plus what to do about uneven squads.",
  },
  referee: {
    label: "The referee",
    blurb: "Who referees, what they can give plus why there is no sin bin.",
  },
  safety: {
    label: "Safety and welfare",
    blurb: "Head knocks, mouthguards, hard ground plus mixed rugby.",
  },
  coaching: {
    label: "Running a session",
    blurb: "How long, how many helpers plus what to do if you never played.",
  },
};

export interface Question {
  topic: QuestionTopic;
  question: string;
  /** Two or three sentences. It gets read standing up. */
  answer: string;
  /** The earliest grade this applies at. */
  from: AgeGroup;
  /** The last grade it applies at, where it stops before U12. */
  to?: AgeGroup;
}

/**
 * The grades an answer holds for, as a coach would say it.
 *
 * Every answer carries one, because this content is not age gated and a rule
 * quoted with no grade on it is how a U8 coach ends up coaching a ruck.
 */
export function questionGrades(question: Question): string {
  const from = AGE_GROUP_LABELS[question.from];
  if (!question.to) {
    return question.from === AGE_GROUPS[0] ? "Every grade" : `${from} and up`;
  }
  const to = AGE_GROUP_LABELS[question.to];
  if (question.from === question.to) return `${from} only`;
  return `${from} to ${to}`;
}

export const QUESTIONS: Question[] = [
  // ---- Tag ----
  {
    topic: "tag",
    from: "u7",
    to: "u8",
    question: "What happens when a player is tagged?",
    answer:
      "They've three seconds to pass and about three strides to stop in, so the ball can go " +
      "while they're still slowing down. Then they collect their tag off the tagger, put it " +
      "back on the belt and rejoin. Playing on without both tags is a free pass against them.",
  },
  {
    topic: "tag",
    from: "u7",
    to: "u8",
    question: "Can a tagged player still score?",
    answer:
      "One step, no more. If they're tagged a stride out they can take that step and ground " +
      "it. Anything past that and the referee brings it back, so the try doesn't stand.",
  },
  {
    topic: "tag",
    from: "u8",
    to: "u8",
    question: "What is the six tag turnover?",
    answer:
      "A team may be tagged six times while they've the ball. On the seventh the referee stops " +
      "play and gives a free pass to the other side where that tag happened. Both coaches can " +
      "agree a lower number before kick off to stretch a strong squad. If you can't agree, " +
      "it's seven.",
  },
  {
    topic: "tag",
    from: "u7",
    to: "u8",
    question: "Where do the tags go on the belt?",
    answer:
      "One over each hip, Velcroed on, with the belt outside the shirt so nobody has to dig " +
      "for them. Any spare length of belt gets tucked away where it can't be grabbed. They " +
      "also have to stand out against the kit, so no red tags over a red shirt.",
  },
  {
    topic: "tag",
    from: "u7",
    to: "u8",
    question: "Can a defender pull the ball out of somebody's hands?",
    answer:
      "No. Taking a tag off the belt is the only contact there is between the two teams. " +
      "Shirt pulling, barging, running in front of the carrier or shepherding them into touch " +
      "are all a free pass against you, the same as a hand off is.",
  },
  {
    topic: "tag",
    from: "u7",
    to: "u7",
    question: "Can a U7 dive over the line to score?",
    answer:
      "No. A dive is disallowed at U7 and the defending team gets a free pass 3 metres out. " +
      "Grounding it on their knees does count, though it's worth a word afterwards about " +
      "staying on their feet. Going to ground to score is one of the things U8 adds.",
  },
  {
    topic: "tag",
    from: "u7",
    to: "u8",
    question: "Is a knock on an offence in tag rugby?",
    answer:
      "It depends which year you're in, which is the one that surprises people. At U7 an " +
      "accidental knock forward is simply played on. At U8 it becomes an offence and the " +
      "other side gets a free pass.",
  },

  // ---- The tackle ----
  {
    topic: "tackle",
    from: "u9",
    question: "How high is a child allowed to tackle?",
    answer:
      "Below the base of the sternum, which the RFU spells out as the tummy or belly or " +
      "below. Contact above that line stops the game, the offender gets spoken to and the " +
      "other side restarts. The line is the same at every grade from U9 right through U12.",
  },
  {
    topic: "tackle",
    from: "u9",
    question: "What actually counts as a tackle?",
    answer:
      "The carrier is held by one or more opponents and brought to ground, with arms used. A " +
      "carrier who was never held hasn't been tackled, whatever it looked like from the " +
      "touchline. That distinction is behind about half the decisions a parent queries.",
  },
  {
    topic: "tackle",
    from: "u9",
    to: "u9",
    question: "Why can't my U9 defender grab the ball?",
    answer:
      "Because there's no contest for it at U9 at all. The tackler may hold on to stop the " +
      "carrier gaining ground, but they may not grab at the ball or block the pass. They " +
      "release the moment it's gone. Possession changes hands on a knock on, a forward pass " +
      "or an infringement rather than in contact. That's the single biggest difference " +
      "between U9 and U10.",
  },
  {
    topic: "tackle",
    from: "u9",
    question: "What does the referee mean by Tackle-Release?",
    answer:
      "It's the call once the carrier is on the ground. The tackler lets go straight away, " +
      "gets to their feet as soon as they can, doesn't touch the ball, doesn't block the pass " +
      "and gets back onside between their own goal line and the tackled player. Most free " +
      "passes given against a young side are somebody who stayed down.",
  },
  {
    topic: "tackle",
    from: "u9",
    question: "My player was held up on their feet. What happens now?",
    answer:
      "The referee gives it about three seconds to see whether they're genuinely held, then " +
      "calls \"Tackle\". From that call there are three seconds to pass, standing or off the " +
      "ground. They can keep going forward while they do it. Once the call has been made " +
      "they can't score.",
  },
  {
    topic: "tackle",
    from: "u9",
    question: "Why was my player penalised for going in with a shoulder?",
    answer:
      "The carrier may not go into contact with their shoulders below their hips, dip down " +
      "late and low, or put their head into an opponent's head space. It's the carrier's job " +
      "as much as the tackler's to keep the collision where it's safe. Running in low with a " +
      "shoulder is the most common version of it.",
  },
  {
    topic: "tackle",
    from: "u9",
    question: "Can a teammate drive the ball carrier forward?",
    answer:
      "No. Nobody may drive the carrier on with a shoulder or by binding onto them. " +
      "Nobody may stand either side of them to keep the next tackler off. Both are a free " +
      "pass. Support comes from behind.",
  },

  {
    topic: "tackle",
    from: "u12",
    question: "Can the ball carrier hand somebody off?",
    answer:
      "Not until U12. Below the armpit even then, because anything higher is foul play and " +
      "always was. Every player in your squad has spent four seasons being told a fend is a " +
      "free pass against them, so expect it to take a while to turn up, then to turn up too " +
      "high.",
  },

  // ---- Ruck and maul ----
  {
    topic: "ruck",
    from: "u10",
    question: "How many players can be in a ruck?",
    answer:
      "Two a side at U10, three a side at U11, with no cap at all from U12. The count " +
      "includes the ball carrier and the opponent, so at U10 a third body piling in gives " +
      "away a free pass. The RFU describes U10 as a contest of one player against one.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "What does the referee mean by \"Use it\"?",
    answer:
      "The ball has been won and you've five seconds to play it. Miss that and it's a free " +
      "pass to the other side at U10, or a scrum to them from U11. A squad that has never " +
      "heard the call will freeze the first time, so it's worth putting into your training " +
      "games in September.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "When can a supporting player pick the ball up and run?",
    answer:
      "Only if no ruck has formed. Once one has, the choices are to rip it and pass " +
      "immediately, pick it up and pass it away from the contact, or join from your own side " +
      "and drive over the ball. If somebody has already driven over it, the next player to " +
      "arrive has to pass it.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "Where is the offside line at a ruck?",
    answer:
      "The hindmost foot or hindmost point of the players involved. Defenders stay between " +
      "that line and their own goal line until the pass is made. At U9 offside really only " +
      "happened at the tackle, so this is new ground for a squad coming up.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "When can the tackler play the ball?",
    answer:
      "After they've released the carrier and got back to their feet. Not before. A tackler " +
      "who reaches out from the floor is the single most penalised thing at U10. It's " +
      "worth coaching as a habit rather than as a rule.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "What is a maul at this age?",
    answer:
      "The carrier is held up by one or two opponents and one of their own team binds onto " +
      "them, so it's three players minimum, all on their feet, all moving towards a goal " +
      "line. The same cap applies as at the ruck. Once it's formed there are five seconds to " +
      "play the ball.",
  },
  {
    topic: "ruck",
    from: "u10",
    question: "My player was held up but still standing. Why the free pass?",
    answer:
      "When the carrier is held, upright and no longer going forward, the ball has to be " +
      "played away from the contact. There's no three second count here and no shout to wait " +
      "for. Leave it in there and it's a free pass against you. Half a squad's first month at " +
      "U10 goes on moving it before anyone tells them to.",
  },

  // ---- The scrum ----
  {
    topic: "scrum",
    from: "u10",
    question: "What happens if the ball comes out the wrong side of the scrum?",
    answer:
      "Play carries on. The ball is out of the scrum the moment it leaves it, whichever side " +
      "that is, so whoever gets to it first can play it. If the referee thinks it was never " +
      "put in straight or that somebody pulled it out with a hand, they'll set it again. " +
      "Nobody pushes at any minis grade, so a scrum that goes wrong gets reset rather than " +
      "turned into a penalty.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "How many players are in a scrum?",
    answer:
      "Three a side at U10 and U11, a prop either side of the hooker. It goes to five at U12, " +
      "set up in a 3-2. They're whoever happens to be nearest the stoppage rather than " +
      "specialists. The next nearest becomes the scrum half.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "Should I pick my strongest children for the front row?",
    answer:
      "No. The RFU is deliberate about it. Their phrase is all players trained, late " +
      "specialisation, so the front row is simply the nearest three to the stoppage. Over a " +
      "season everybody ends up in there. Anyone who goes in, replacements included, should " +
      "have been trained for it first.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "Is anybody allowed to push in a minis scrum?",
    answer:
      "Nobody, at any grade up to U12. Pushing arrives at U13 and even then it's 1.5 metres. " +
      "So the whole thing is about shape and binding rather than about shoving, which is " +
      "duller than your squad wants it to be and is what keeps their necks safe.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "What does the referee call before a scrum?",
    answer:
      "Crouch, then bind, then set. Each prop binds onto the back or side of their opposite " +
      "number with the outside arm. No charging in, heads and shoulders never below the hips, " +
      "no downward pressure.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "Can the scrum half pick the ball up and run?",
    answer:
      "Not from a scrum. They pass it away from the base, with no running and no kicking, at " +
      "every grade through U12. From a ruck it's different: a U12 scrum half may pass or pick " +
      "and go, though still not box kick.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "Who may strike for the ball?",
    answer:
      "At U10 only the team throwing in. From U11 both hookers may contest it, which turns " +
      "the scrum from a pure restart into a small contest. A hooker who has never struck for " +
      "a ball won't work it out in a match, so give more than one of them a go in training.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "What happens if a scrum collapses?",
    answer:
      "The whistle goes immediately. A player who keeps collapsing it or binding illegally " +
      "takes no further part in the scrum. One whose technique or strength makes them a " +
      "danger gets replaced. None of that is a punishment, it's the one place in minis where " +
      "a referee will stop something dead.",
  },
  {
    topic: "scrum",
    from: "u10",
    question: "Where does a scrum go if it is awarded next to the try line?",
    answer:
      "It gets moved out, so the middle of it sits 5 metres from the goal line. Both back " +
      "lines then stay 5 metres behind the scrum until the ball is out, which is more room " +
      "than most pitches look like they have.",
  },

  // ---- Restarts and touch ----
  {
    topic: "restarts",
    from: "u7",
    question: "Is there a lineout in minis rugby?",
    answer:
      "No, at any grade from U7 to U12. Touch restarts with a free pass and Regulation 15 " +
      "keeps it that way all the way through U13. The uncontested lineout arrives at U14 and " +
      "lifting waits until U15, so a night spent on throwing is a night spent on something " +
      "the referee will never ask for.",
  },
  {
    topic: "restarts",
    from: "u9",
    question: "What happens when the ball goes into touch?",
    answer:
      "A free pass 5 metres in from the touchline, level with where it went out, with the " +
      "other side 7 metres back and nobody running until the pass is made. From U11 you can " +
      "take a quick throw instead, as long as the same ball hasn't been touched by anybody " +
      "off the pitch.",
  },
  {
    topic: "restarts",
    from: "u7",
    question: "What is a free pass?",
    answer:
      "The way almost everything restarts in minis. The passer holds the ball in both hands, " +
      "waits for the referee to call \"Play\", then passes backwards through the air. Nobody " +
      "on either side moves until the ball has left their hands. One is never marked within 3 " +
      "metres of a goal line, so both teams have room.",
  },
  {
    topic: "restarts",
    from: "u7",
    question: "How far back does the other team stand?",
    answer:
      "Three metres at U7 and seven from U8 upwards. It's the referee's job to walk them " +
      "back, though on a busy match day it's worth your touchline knowing the number so nobody " +
      "argues about it.",
  },
  {
    topic: "restarts",
    from: "u11",
    question: "What is a free kick and when do we get one?",
    answer:
      "From U11, free kicks replace free passes for the serious offences: a fend or hand off, " +
      "foul play, offside, squeeze ball, diving off your feet, pushing in the scrum, a high " +
      "tackle. Opponents go back 7 metres. Everything else still restarts with a free pass.",
  },
  {
    topic: "restarts",
    from: "u11",
    question: "How does a half start from U11?",
    answer:
      "With a drop kick that has to travel 7 metres, rather than the free pass it was up to " +
      "U10. Fall short and the other side chooses between a re-kick or a scrum on halfway. " +
      "After a score the side that didn't score chooses whether to kick or receive.",
  },
  {
    topic: "restarts",
    from: "u7",
    question: "What happens if the ball is grounded over a goal line by accident?",
    answer:
      "It's the corner nobody knows and it comes up about twice a season. Drop it over your " +
      "own line with the opposition grounding it and that's a try to them. Ground it yourself " +
      "and the attacking side gets a free pass 7 metres out. Take it back over your own line " +
      "yourself then ground it and it's a try against you.",
  },

  // ---- Kicking ----
  {
    topic: "kicking",
    from: "u11",
    question: "When are children allowed to start kicking?",
    answer:
      "U11. There's no kicking of any kind at U7 through U10, which catches out every parent " +
      "who has watched a game on television. It's why U11 coaches spend all of September on " +
      "catching a high ball that nobody in the squad has ever had to deal with.",
  },
  {
    topic: "kicking",
    from: "u11",
    question: "What kicks are allowed at U11 and U12?",
    answer:
      "Tactical kicking from hand, anywhere on the pitch, plus drop kick restarts. " +
      "Conversions, penalty kicks at goal, box kicks and drop goals are all out. Fly hacking " +
      "a loose ball along the ground stays out at every minis grade.",
  },
  {
    topic: "kicking",
    from: "u11",
    to: "u11",
    question: "Why did the referee give the scrum to the team that knocked it forward?",
    answer:
      "If a player was trying to catch a kick in open play and knocked it on, that isn't " +
      "treated as a knock on at U11 and the catching team gets the scrum. It applies at U11 " +
      "only. It's there because this is their first season of kicking and the RFU would " +
      "rather they had a go at catching it than stood back and let it bounce. Tell your " +
      "touchline in week one, because it'll come up in week two.",
  },
  {
    topic: "kicking",
    from: "u11",
    question: "What is a mark and can we call one?",
    answer:
      "Yes, anywhere on the pitch, from a kick in open play. Not from a restart or a free " +
      "kick. The catcher's team then gets a free kick. It's one of the few bits of adult law " +
      "that arrives in minis exactly as the grown ups have it.",
  },
  {
    topic: "kicking",
    from: "u11",
    question: "We kicked straight into touch and lost the ball. Why?",
    answer:
      "Kick from outside your 15 metre zone straight into touch and the other side gets the " +
      "free pass in line with where you kicked it, 5 metres in, so you've handed them ground " +
      "as well as possession. Inside your own 15 metre area it's taken where the ball crossed " +
      "the line.",
  },
  {
    topic: "kicking",
    from: "u11",
    question: "Who is offside when we kick?",
    answer:
      "Anybody in front of the kicker. They stay still, or retire if they're within 7 metres " +
      "of where the ball lands. A kick that nobody is allowed to chase is a kick you've given " +
      "away, which is worth a session of its own before it costs you a match.",
  },

  // ---- Match day ----
  {
    topic: "match-day",
    from: "u7",
    question: "What is the Half Game Rule?",
    answer:
      "Every player in your squad gets at least half of the available playing time. It holds " +
      "at every age grade and it's the one clubs get wrong most often, usually by accident " +
      "rather than on purpose. Match day works the rotations out on the touchline so nobody " +
      "has to count it on the back of a team sheet.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "Does half the game mean half of every single match?",
    answer:
      "No. Across a festival it means half of the morning rather than half of each game, so a " +
      "child can sit out one match entirely as long as the total comes good. That's the part " +
      "clubs miss, because counting per game is easier and gives the wrong answer.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "How many substitutions are we allowed?",
    answer:
      "As many as you like. Rolling substitutions are unlimited at every minis grade, only " +
      "while the ball is dead and always with the referee's permission. A player who comes " +
      "off can go back on later, which is what makes an honest rotation possible at all.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "We have more players than the other team. What do we do?",
    answer:
      "Both sides put the same number out, so you play down to theirs and rotate more often. " +
      "That's a Half Game Rule problem rather than a rules problem: with fifteen children and " +
      "eight shirts, somebody is off for a long time unless you plan it before kick off.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "How long is a game at each grade?",
    answer:
      "Halves of 10 minutes at U7 and U8, 15 at U9 and U10, then 20 at U11 and U12. Those are " +
      "maximums. A festival organiser running eight teams through a morning will often make " +
      "them shorter, which is where the playing time maths gets interesting.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "How many players a side at each grade?",
    answer:
      "Four at U7, six at U8, seven at U9, eight at U10, nine at U11 then twelve at U12. The " +
      "jump at U12 is the biggest of them and it happens on the same size pitch as U11, so " +
      "there's noticeably less room.",
  },
  {
    topic: "match-day",
    from: "u7",
    question: "Can we agree to change anything before kick off?",
    answer:
      "Some of it, yes. Pitch sizes are maximums, so the referee and both coaches can agree " +
      "something smaller whenever they think it's safer. At U8 both coaches can agree a lower " +
      "tag count. What you can't do is agree your way into a phase of play the grade doesn't " +
      "have.",
  },

  // ---- The referee ----
  {
    topic: "referee",
    from: "u7",
    question: "Is there a sin bin in minis rugby?",
    answer:
      "No, at any grade. The referee has a word with the coaches on the touchline and the " +
      "sides stay even. Nobody gets sent off a minis pitch for something that would be ten " +
      "minutes in the adult game.",
  },
  {
    topic: "referee",
    from: "u7",
    question: "Can I go onto the pitch during play?",
    answer:
      "No. Coaches stay off while the ball is in play at every minis grade. The referee is " +
      "expected to talk the players through it instead, which is a different job to the one " +
      "they do in the adult game and takes some getting used to on both sides.",
  },
  {
    topic: "referee",
    from: "u7",
    question: "Who referees a minis game?",
    answer:
      "Usually a coach or a club volunteer rather than a society referee. Your club will tell " +
      "you what they want you to have done before you pick up a whistle, since that varies by " +
      "club and by county. Expect to be doing it at some point if you're running an age " +
      "group.",
  },
  {
    topic: "referee",
    from: "u7",
    question: "The referee gave a decision I am sure was wrong. What now?",
    answer:
      "They're right and you get on with it. That's not a platitude: at minis the referee is " +
      "usually another parent doing you a favour. A coach arguing on the touchline is the " +
      "reason clubs struggle to find anybody to do it next season. Ask them afterwards if you " +
      "genuinely want to know.",
  },
  {
    topic: "referee",
    from: "u7",
    question: "What can the referee actually give?",
    answer:
      "A free pass for almost everything, all the way up to U10. From U11 the serious " +
      "offences become free kicks with opponents 7 metres back. There are no penalty kicks at " +
      "goal anywhere in minis, so nothing a referee gives you can be turned into points " +
      "directly.",
  },
  {
    topic: "referee",
    from: "u7",
    question: "Somebody on our touchline is out of order. Whose job is that?",
    answer:
      "Yours, before it's anybody else's. You're the adult the club put in charge of that age " +
      "group and a word early is easier than a conversation later. Your club will have a code " +
      "of conduct and a welfare officer, so use both rather than carrying it on your own.",
  },

  // ---- Safety and welfare ----
  {
    topic: "safety",
    from: "u7",
    question: "A child has taken a bang to the head. What do I do?",
    answer:
      "If in doubt, sit them out. They don't come back on that day. Concussion in " +
      "children is taken more seriously than in adults and the return is staged over weeks " +
      "rather than days. The RFU's Headcase programme is the thing to read before the season " +
      "rather than on the morning it happens.",
  },
  {
    topic: "safety",
    from: "u9",
    question: "Do they have to wear a mouthguard?",
    answer:
      "The RFU strongly recommends one from the moment contact starts and most clubs make it " +
      "a condition of playing. Check what yours asks for. A moulded one from a chemist is " +
      "fine at this age. It wants replacing as their teeth change.",
  },
  {
    topic: "safety",
    from: "u7",
    question: "The pitch is frozen. Should we play?",
    answer:
      "That call belongs to whoever is standing on it, which means the referee and both " +
      "coaches together. Frozen ruts turn an ankle in a tag game just as readily as they hurt " +
      "somebody going to ground, so it isn't only a question for the contact grades.",
  },
  {
    topic: "safety",
    from: "u9",
    question: "One child is far bigger than everybody else. What do I do about it?",
    answer:
      "Manage it rather than ignore it. Who they're matched against in contact work is your " +
      "decision at training. It's worth a word with the other coach before a game. The " +
      "same goes the other way for a child who is much smaller, who will stop turning up long " +
      "before they tell you why.",
  },
  {
    topic: "safety",
    from: "u7",
    question: "Can boys and girls play together?",
    answer:
      "In matches, all the way through U11. From U12 the game splits into separate bands and " +
      "the girls in your squad move into girls' rugby, which catches clubs out in September " +
      "when it should have been sorted in June. Training is different: a non-contact session " +
      "with nothing competitive in it can be mixed at any age once you've judged it safe.",
  },
  {
    topic: "safety",
    from: "u10",
    question: "What is squeezeball and why is it banned?",
    answer:
      "It's going to ground and feeding the ball back through your own legs from a curled " +
      "position. It's out at every age grade and no coach may teach it, because of what it " +
      "does to a neck and a spine when somebody arrives on top. If you've seen it at your " +
      "club, it came from a video rather than from a coaching course.",
  },
  {
    topic: "safety",
    from: "u9",
    question: "How much contact should one training session have?",
    answer:
      "Less than a new coach expects. The RFU publishes contact training guidance with limits " +
      "worth knowing before you plan a season rather than a session. In practical terms, " +
      "contact goes early while they're fresh, in short goes, with the handling work either " +
      "side of it.",
  },

  // ---- Running a session ----
  {
    topic: "coaching",
    from: "u7",
    question: "How long should a training session be?",
    answer:
      "About an hour, though 45 minutes is plenty at U7 and U8. Clubs book slots of 45, 60 or 75 " +
      "minutes, which is why the ready-made sessions here come at those lengths. The last ten " +
      "minutes of a long session with seven-year-olds is rarely worth having.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "How many drills should I plan for an hour?",
    answer:
      "Four or five, with a game at the end. A warm-up, two pieces of work, then something " +
      "where they have to use it under a bit of pressure. Plan more than that and you'll " +
      "either rush it or drop it, which children notice either way.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "How many helpers do I need?",
    answer:
      "One adult per group of about five or six once you're running stations. Twenty children " +
      "and four parents is four groups rotating round four corners of a pitch, which is what " +
      "most sessions actually look like. The carousel sessions here are built for exactly that.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "I never played rugby. Can I still coach it?",
    answer:
      "Most people running a minis age group never played, so you're in the majority rather " +
      "than the exception. What you need is what going right looks like and what going wrong " +
      "looks like, which is why every drill here says both. Your club will put you through a " +
      "coaching course. The rest is turning up.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "What kit do I actually need to bring?",
    answer:
      "Cones, a few balls of the right size, bibs in two colours and a pump. Tag belts up to " +
      "U8. Shields and pads arrive with contact at U9 and your club will have them, so borrow " +
      "before you buy anything yourself. Each session here prints a kit list off the drills in " +
      "it.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "What should the first session of the season be?",
    answer:
      "Handling, plus whatever arrives at your grade this year. Every squad picks up new " +
      "players in September who have never done last year's work either, so the new thing " +
      "isn't the only thing to cover. Each grade's rules guide here ends with what to get in " +
      "before the first game.",
  },
  {
    topic: "coaching",
    from: "u7",
    question: "How much of a session should be games rather than drills?",
    answer:
      "More than feels right the first time you try it. Children learn to play by playing. " +
      "A drill with no pressure in it produces a skill that falls apart the moment " +
      "somebody chases them. Finish on a game where they have to use whatever you worked on.",
  },
];

/**
 * The grades a whole topic holds for, when every answer in it agrees.
 *
 * Nine answers on the scrum page each captioned "U10 and up" is the caption
 * saying nothing, which is the same failure as "U10" on all six ready-made
 * session cards. Where a topic is uniform its page says the grades once and
 * the answers under it go bare. Where it is mixed, every answer carries its
 * own, because there the caption is the whole point.
 */
export function topicGrades(topic: QuestionTopic): string | undefined {
  const questions = questionsFor(topic);
  const first = questionGrades(questions[0]);
  return questions.every((question) => questionGrades(question) === first) ? first : undefined;
}

/** Every question filed under a topic, in the order they are written. */
export function questionsFor(topic: QuestionTopic): Question[] {
  return QUESTIONS.filter((question) => question.topic === topic);
}

/**
 * The address a topic publishes at.
 *
 * Question-shaped rather than key-shaped, the same way a coaching guide is
 * `/how-to-teach-rugby-scrums`. It names the sport because a generated title
 * that does not is a page competing for somebody else's word. It is also the
 * phrase somebody types.
 */
export function questionsPath(topic: QuestionTopic): string {
  return `/rugby-${topic}-questions`;
}

export const QUESTIONS_INDEX_PATH = "/rugby-questions";

/**
 * Free text against the question and the answer, both.
 *
 * The answer matters as much as the question: a coach searching "wrong side"
 * is repeating what they saw rather than the heading somebody filed it under.
 * Same reason `filterDrills` puts a drill's faults in the haystack.
 */
export function searchQuestions(term: string, within: Question[] = QUESTIONS): Question[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return within;
  return within.filter((question) =>
    `${question.question} ${question.answer}`.toLowerCase().includes(needle),
  );
}

/** The floor a topic's questions may not claim to apply below, where it has one. */
export function topicFloor(topic: QuestionTopic): AgeGroup | undefined {
  const theme = TOPICS[topic].theme;
  return theme ? THEME_MIN_AGE[theme] : undefined;
}
