export interface AppConfig {
  eventName: string;
  boothName: string;
  eventHashtag: string;
  eventStartDate: string;
  eventTotalDays: number;
  currentDay: number;
}

export function getConfig(): AppConfig {
  const eventStartDate = process.env.EVENT_START_DATE || "2026-04-30";
  const totalDays = parseInt(process.env.EVENT_TOTAL_DAYS || "2", 10);
  const override = process.env.EVENT_DAY_OVERRIDE;

  let currentDay = 1;
  if (override) {
    currentDay = Math.max(1, Math.min(totalDays, parseInt(override, 10)));
  } else {
    const start = new Date(`${eventStartDate}T00:00:00`);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) currentDay = 1;
    else if (diffDays >= totalDays) currentDay = totalDays;
    else currentDay = diffDays + 1;
  }

  return {
    eventName: process.env.EVENT_NAME || "Our Event",
    boothName: process.env.BOOTH_NAME || "Photo Booth",
    eventHashtag: process.env.EVENT_HASHTAG || "",
    eventStartDate,
    eventTotalDays: totalDays,
    currentDay,
  };
}
