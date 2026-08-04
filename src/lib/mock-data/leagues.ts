import type { Conference, League } from "@/lib/types";

export const leagues: League[] = [
  {
    id: "nba",
    code: "NBA",
    name: "National Basketball Association",
    season: "2025-2026",
    salaryCap: 154_647_000, // cap réel saison 2025-26
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
