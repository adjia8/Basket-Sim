import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQuestions, type PressGameContext, type PressTopic } from "../../src/lib/careers/press-rules";

const p = (id: string) => ({ id, name: `Joueur ${id.toUpperCase()}` });

const base: PressGameContext = {
  teamName: "Los Angeles Lakers",
  teamShortName: "Lakers",
  teamCity: "Los Angeles",
  opponentName: "Boston Celtics",
  won: true,
  teamScore: 110,
  opponentScore: 104,
  wins: 20,
  losses: 15,
  streak: "W1",
  rank: 10,
  leagueSize: 30,
  gamesInSeason: 82,
};

function topicsFor(ctx: Partial<PressGameContext>, runs = 40): Set<PressTopic> {
  const seen = new Set<PressTopic>();
  for (let i = 0; i < runs; i++) for (const q of generateQuestions(60, "fr", { ...base, ...ctx })) seen.add(q.topic);
  return seen;
}

// Un contexte par événement : l'événement doit produire SA question.
const EVENTS: [PressTopic, Partial<PressGameContext>][] = [
  ["overtime", { overtimes: 1, teamScore: 120, opponentScore: 117 }],
  ["comeback", { comebackFrom: 16 }],
  ["triple_double", { tripleDouble: { ...p("a"), points: 24, rebounds: 11, assists: 12 } }],
  ["opponent_star", { won: false, teamScore: 101, opponentScore: 110, opponentStar: { name: "Star Adverse", points: 42 } }],
  ["back_to_back", { won: false, teamScore: 99, opponentScore: 104, backToBack: true }],
  ["injury_return", { returningPlayer: p("b") }],
  ["nba_cup", { cupStage: "sf" }],
  ["season_opener", { wins: 1, losses: 0 }],
  ["playoff_race", { wins: 34, losses: 34, rank: 18 }],
  ["tanking", { wins: 12, losses: 40, rank: 29 }],
  ["mvp_race", { wins: 30, losses: 10, mvpCandidate: p("c") }],
  ["contract_year", { expiringStar: p("d") }],
  ["unhappy_player", { unhappyPlayer: { ...p("e"), request: "minutes" } }],
  ["all_star", { allStars: { selected: [p("f")] } }],
  ["all_star_snub", { allStars: { selected: [], snub: p("g") } }],
  ["attendance", { arena: { attendance: 35, ticketLevel: 100 } }],
  ["luxury_tax", { luxuryTax: true }],
  ["owner_goals", { ownerGoal: { type: "win_pct", behind: true } }],
  ["former_player", { formerPlayer: { name: "Ancien Joueur" } }],
  ["series_over", { playoffSeries: { teamWins: 4, opponentWins: 2, bestOf: 7 } }],
];

test("conférences de presse : chaque événement de la saison produit sa question", () => {
  for (const [topic, ctx] of EVENTS) {
    assert.ok(topicsFor(ctx).has(topic), `aucune question « ${topic} »`);
  }
  // Sans l'événement, la question n'existe pas.
  const plain = topicsFor({});
  for (const topic of ["overtime", "comeback", "nba_cup", "all_star", "series_over"] as PressTopic[]) {
    assert.ok(!plain.has(topic), `« ${topic} » posée sans raison`);
  }
});

test("conférences de presse : série terminée = bilan de série, plus de question « suite de la série »", () => {
  const over = topicsFor({ playoffSeries: { teamWins: 1, opponentWins: 4, bestOf: 7 } });
  assert.ok(over.has("series_over"));
  assert.ok(!over.has("playoff_series"));
  const ongoing = topicsFor({ playoffSeries: { teamWins: 2, opponentWins: 1, bestOf: 7 } });
  assert.ok(ongoing.has("playoff_series") && !ongoing.has("series_over"));
});

test("conférences de presse : plusieurs formulations par sujet et réponses variées", () => {
  const rich: Partial<PressGameContext>[] = [
    {
      won: true, teamScore: 130, opponentScore: 104, streak: "W6",
      topPerformer: { ...p("a"), points: 38, rebounds: 9, assists: 7 },
      injury: { ...p("b"), label: "Entorse", gamesOut: 12, severity: "moderate" },
      youngPlayer: { ...p("c"), age: 20, points: 18 }, wornPlayer: p("d"), tradeRequester: p("e"),
      newArrival: p("f"), tradeDeadlineDays: 4,
    },
    {
      won: false, teamScore: 98, opponentScore: 100, streak: "L5", wins: 8, losses: 20, rank: 27,
      topPerformer: { ...p("a"), points: 24, rebounds: 5, assists: 4 }, strugglingStar: { ...p("g"), points: 6 },
    },
    { won: false, teamScore: 90, opponentScore: 121, streak: "L1" },
    { playoffSeries: { teamWins: 2, opponentWins: 2, bestOf: 7 } },
  ];
  const prompts = new Map<string, Set<string>>();
  const answers = new Map<string, Set<string>>();
  for (let i = 0; i < 400; i++) {
    for (const ctx of rich) {
      for (const q of generateQuestions(60, "fr", { ...base, ...ctx })) {
        if (!prompts.has(q.topic)) prompts.set(q.topic, new Set());
        prompts.get(q.topic)!.add(q.prompt);
        for (const o of q.options) {
          const key = `${q.topic}:${o.tone}`;
          if (!answers.has(key)) answers.set(key, new Set());
          answers.get(key)!.add(o.label);
        }
        for (const text of [q.prompt, ...q.options.map((o) => o.label)]) {
          assert.ok(!/undefined|NaN|\$\{/.test(text), `texte cassé : ${text}`);
        }
      }
    }
  }
  assert.ok(prompts.size >= 20, `seulement ${prompts.size} sujets`);
  for (const [topic, set] of prompts) {
    assert.ok(set.size >= 2, `« ${topic} » n'a qu'une seule formulation`);
  }
  const avg = [...prompts.values()].reduce((s, x) => s + x.size, 0) / prompts.size;
  assert.ok(avg >= 3.5, `variété moyenne trop faible : ${avg.toFixed(1)} formulations par sujet`);
  const varied = [...answers.values()].filter((s) => s.size >= 2).length;
  assert.ok(varied / answers.size >= 0.9, `réponses trop figées (${varied}/${answers.size})`);
});

test("conférences de presse WNBA : accords au féminin dans les nouveaux sujets", () => {
  const ctx = { ...base, women: true, allStars: { selected: [], snub: p("h") }, returningPlayer: p("i") };
  const texts: string[] = [];
  for (let i = 0; i < 60; i++) for (const q of generateQuestions(60, "fr", ctx)) texts.push(q.prompt, ...q.options.map((o) => o.label));
  assert.ok(texts.some((t) => /retenue|l'avez-vous trouvée/.test(t)), "pas d'accord féminin");
  assert.ok(!texts.some((t) => /\bretenu pour\b/.test(t)));
});

// ---------------------------------------------------------------------------
// Réactions aux déclarations (joueurs, médias, fans)

import { pressReactions, type ReactionInput, type ReactionPlayer } from "../../src/lib/careers/press-reactions-rules";
import type { Personality } from "../../src/lib/careers/personality-rules";

const pers = (o: Partial<Personality>): Personality => ({ professionalism: 10, ambition: 10, loyalty: 10, temperament: 10, leadership: 8, ...o });
const player = (id: string, renown: number, o: Partial<Personality>): ReactionPlayer => ({ id, name: `Joueur ${id}`, renown, personality: pers(o), hasPendingRequest: false });
const fx = (morale: number, publicOpinion: number, frontOfficeApproval: number, extra = {}) => ({ morale, publicOpinion, frontOfficeApproval, ...extra });

function react(over: Partial<ReactionInput>) {
  return pressReactions({
    locale: "fr", women: false, teamShortName: "Lakers", teamCity: "Los Angeles", winPct: 0.5, gamesPlayed: 30,
    skipped: false, answers: [], roster: [], recentTones: [], random: () => 0.1, ...over,
  });
}

test("réactions : chaque joueur réagit à une critique publique selon son caractère", () => {
  const critique = { topic: "star_struggle", tone: "aggressive" as const, label: "« Il doit en faire plus. »", effects: fx(-1, 1, 1, { playerMorale: -10 }), playerId: "a", outlet: "Hot Take Radio" };
  const hot = react({ answers: [critique], roster: [player("a", 80, { temperament: 3 })] });
  assert.equal(hot.players[0].kind, "public_reply");
  assert.ok(hot.players[0].requestMeeting && hot.effects.publicOpinion < 0);
  const pro = react({ answers: [critique], roster: [player("a", 80, { professionalism: 17 })] });
  assert.equal(pro.players[0].kind, "takes_it_well");
  assert.ok(pro.players[0].moraleDelta > 0);
  const sulky = react({ answers: [critique], roster: [player("a", 80, {})] });
  assert.equal(sulky.players[0].kind, "wants_meeting");
  const praise = { ...critique, tone: "passionate" as const, effects: fx(1, 2, 0, { playerMorale: 8 }) };
  assert.equal(react({ answers: [praise], roster: [player("a", 80, { ambition: 16 })] }).players[0].kind, "fired_up");
});

test("réactions : le leader du vestiaire soutient le coach ou défend le groupe", () => {
  const shout = { topic: "locker_room", tone: "aggressive" as const, label: "« Trop confortable. »", effects: fx(-1, 1, 2, { squadMorale: -2 }), playerId: null, outlet: "Panier Plus" };
  const backs = react({ answers: [shout], roster: [player("l", 70, { leadership: 18, professionalism: 15 })] });
  assert.equal(backs.players[0].kind, "leader_backs_coach");
  assert.ok(backs.effects.squadMorale > 0);
  const defends = react({ answers: [shout], roster: [player("l", 70, { leadership: 18, professionalism: 6 })] });
  assert.equal(defends.players[0].kind, "leader_defends_group");
});

test("réactions : la presse reprend selon la déclaration et se souvient du style du coach", () => {
  const refs = { topic: "referees", tone: "aggressive" as const, label: "« L'arbitrage a été catastrophique. »", effects: fx(2, 2, -2, { refereeCriticism: true }), playerId: null, outlet: "Hot Take Radio" };
  assert.match(react({ answers: [refs] }).media[0].headline, /arbitre/i);
  const wood = { topic: "opponent", tone: "reserved" as const, label: "« Je me concentre sur mon équipe. »", effects: fx(0, 0, 0), playerId: null, outlet: "Courtside Daily" };
  const closed = react({ answers: [wood, wood], recentTones: ["reserved", "reserved", "reserved", "calm", "reserved", "reserved"] });
  assert.match(closed.media[0].headline, /langue de bois/i);
  assert.equal(closed.mediaReputation, "closed");
  assert.ok(closed.effects.publicOpinion <= -2);
  assert.match(react({ skipped: true }).media[0].headline, /fuit/);
});

test("réactions : les fans se moquent, se fâchent ou adorent selon le contexte", () => {
  const title = { topic: "standings", tone: "assertive" as const, label: "« Le titre. »", effects: fx(1, 1, -2), playerId: null, outlet: "Courtside Daily" };
  const mock = react({ answers: [title], winPct: 0.3 });
  assert.ok(mock.fans.some((f) => f.mood === "mock"));
  assert.ok(mock.effects.attendance < 0);
  const star = player("s", 92, {});
  const hitStar = { topic: "star_struggle", tone: "aggressive" as const, label: "« Il doit en faire plus. »", effects: fx(-1, 1, 1, { playerMorale: -10 }), playerId: "s", outlet: "Buzzer Beat" };
  const angry = react({ answers: [hitStar], roster: [star, player("b", 60, {})] });
  assert.ok(angry.fans.some((f) => f.mood === "angry") && angry.effects.attendance < 0);
  const love = { topic: "fans", tone: "passionate" as const, label: "« Merci ! »", effects: fx(1, 3, 0), playerId: null, outlet: "Los Angeles Tribune" };
  assert.ok(react({ answers: [love] }).effects.attendance > 0);
  assert.ok(react({ skipped: true }).fans.some((f) => f.mood === "angry"));
});

test("réactions : un journal différent par article, pas de « on gagne » sans résultats", () => {
  const a = (topic: string) => ({ topic, tone: "aggressive" as const, label: "« Inacceptable. »", effects: fx(-2, 2, 2, { squadMorale: -3, refereeCriticism: topic === "referees" }), playerId: null, outlet: "Hot Take Radio" });
  for (let i = 0; i < 20; i++) {
    const r = pressReactions({
      locale: "fr", women: false, teamShortName: "Lakers", teamCity: "Los Angeles", winPct: 0.5, gamesPlayed: 0,
      skipped: false, answers: [a("referees"), a("locker_room"), a("result")], roster: [], recentTones: [],
    });
    assert.equal(new Set(r.media.map((m) => m.outlet)).size, r.media.length);
    assert.ok(!r.fans.some((f) => /on gagne/.test(f.text)));
  }
});
