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
