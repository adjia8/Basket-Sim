export const keys = [
  "schedule.title",
  "schedule.myTeam",
  "schedule.wholeLeague",
  "schedule.preseasonHeading",
  "schedule.regularSeasonHeading",
  "schedule.upcoming",
] as const;

export type ScheduleKey = (typeof keys)[number];

export const fr: Record<ScheduleKey, string> = {
  "schedule.title": "Calendrier",
  "schedule.myTeam": "Mon équipe",
  "schedule.wholeLeague": "Toute la ligue",
  "schedule.preseasonHeading": "Pré-saison",
  "schedule.regularSeasonHeading": "Saison régulière",
  "schedule.upcoming": "À venir",
};

export const en: Record<ScheduleKey, string> = {
  "schedule.title": "Schedule",
  "schedule.myTeam": "My team",
  "schedule.wholeLeague": "Whole league",
  "schedule.preseasonHeading": "Preseason",
  "schedule.regularSeasonHeading": "Regular season",
  "schedule.upcoming": "Upcoming",
};
