import type { Conference, League } from "@/lib/types";

export const leagues: League[] = [
  {
    id: "nba",
    code: "NBA",
    name: "National Basketball Association",
    season: "2026-2027",
    salaryCap: 164_961_000, // cap officiel saison 2026-27 (pr.nba.com, 30 juin 2026)
    conferenceIds: ["nba-east", "nba-west"],
  },
  {
    id: "wnba",
    code: "WNBA",
    name: "Women's National Basketball Association",
    season: "2026",
    salaryCap: 7_000_000, // cap réel saison 2026 (nouvelle convention collective)
    conferenceIds: ["wnba-east", "wnba-west"],
  },
];

export const conferences: Conference[] = [
  { id: "nba-east", leagueId: "nba", name: "Eastern Conference" },
  { id: "nba-west", leagueId: "nba", name: "Western Conference" },
  { id: "wnba-east", leagueId: "wnba", name: "Eastern Conference" },
  { id: "wnba-west", leagueId: "wnba", name: "Western Conference" },
];
