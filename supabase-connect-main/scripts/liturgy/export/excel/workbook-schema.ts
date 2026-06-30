import type { CanonicalDailyReading } from "../../models/daily-readings.ts";

export type WorkbookCellValue = boolean | number | string | null;

export type WorkbookColumn = {
  key: string;
  header: string;
  width: number;
  extractor: (reading: CanonicalDailyReading) => WorkbookCellValue;
};

export type WorkbookWorksheet = {
  name: string;
  columns: WorkbookColumn[];
};

export type ValidationList = {
  name: string;
  values: string[];
};

export const liturgicalCalendarWorksheet: WorkbookWorksheet = {
  name: "Liturgical Calendar",
  columns: [
    {
      key: "date",
      header: "Date",
      width: 14,
      extractor: (reading) => reading.liturgicalDay.date,
    },
    {
      key: "celebration",
      header: "Celebration",
      width: 48,
      extractor: (reading) => reading.liturgicalDay.celebration,
    },
    {
      key: "season",
      header: "Season",
      width: 24,
      extractor: (reading) => reading.liturgicalDay.season,
    },
    {
      key: "week",
      header: "Week",
      width: 18,
      extractor: (reading) => reading.liturgicalDay.week,
    },
    {
      key: "liturgicalYear",
      header: "Liturgical Year",
      width: 16,
      extractor: (reading) => reading.liturgicalDay.liturgicalYear,
    },
    {
      key: "weekdayCycle",
      header: "Weekday Cycle",
      width: 16,
      extractor: (reading) => reading.liturgicalDay.weekdayCycle,
    },
    {
      key: "liturgicalColor",
      header: "Liturgical Color",
      width: 18,
      extractor: (reading) => reading.liturgicalDay.liturgicalColor,
    },
    {
      key: "rank",
      header: "Rank",
      width: 18,
      extractor: (reading) => reading.liturgicalDay.rank,
    },
    {
      key: "holyDayOfObligation",
      header: "Holy Day of Obligation",
      width: 24,
      extractor: (reading) => reading.liturgicalDay.holyDayOfObligation,
    },
    {
      key: "saint",
      header: "Saint",
      width: 32,
      extractor: (reading) => reading.liturgicalDay.saint,
    },
    {
      key: "lectionaryNumber",
      header: "Lectionary Number",
      width: 20,
      extractor: (reading) => reading.liturgicalDay.lectionaryNumber,
    },
    {
      key: "notes",
      header: "Notes",
      width: 40,
      extractor: (reading) => reading.liturgicalDay.notes,
    },
  ],
};

export const dailyReadingsWorksheet: WorkbookWorksheet = {
  name: "Daily Readings",
  columns: [
    {
      key: "date",
      header: "Date",
      width: 14,
      extractor: (reading) => reading.liturgicalDay.date,
    },
    {
      key: "celebration",
      header: "Celebration",
      width: 48,
      extractor: (reading) => reading.liturgicalDay.celebration,
    },
    {
      key: "firstReadingReference",
      header: "First Reading Reference",
      width: 28,
      extractor: (reading) => reading.dailyReadings.firstReadingReference,
    },
    {
      key: "responsorialPsalmReference",
      header: "Responsorial Psalm Reference",
      width: 32,
      extractor: (reading) => reading.dailyReadings.responsorialPsalmReference,
    },
    {
      key: "psalmResponse",
      header: "Psalm Response",
      width: 48,
      extractor: (reading) => reading.dailyReadings.psalmResponse,
    },
    {
      key: "secondReadingReference",
      header: "Second Reading Reference",
      width: 30,
      extractor: (reading) => reading.dailyReadings.secondReadingReference,
    },
    {
      key: "gospelAcclamation",
      header: "Gospel Acclamation",
      width: 40,
      extractor: (reading) => reading.dailyReadings.gospelAcclamation,
    },
    {
      key: "gospelReference",
      header: "Gospel Reference",
      width: 24,
      extractor: (reading) => reading.dailyReadings.gospelReference,
    },
  ],
};

export const validationLists: ValidationList[] = [
  {
    name: "Liturgical Years",
    values: ["A", "B", "C"],
  },
  {
    name: "Weekday Cycles",
    values: ["I", "II"],
  },
  {
    name: "Liturgical Colors",
    values: ["green", "purple", "white", "red", "rose", "gold"],
  },
  {
    name: "Ranks",
    values: ["weekday", "optional_memorial", "memorial", "feast", "solemnity", "sunday", "holy_day"],
  },
  {
    name: "Boolean",
    values: ["true", "false"],
  },
];

export const liturgicalWorkbookSchema: WorkbookWorksheet[] = [
  liturgicalCalendarWorksheet,
  dailyReadingsWorksheet,
];
