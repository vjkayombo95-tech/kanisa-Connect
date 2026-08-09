const calendarHeaders = [
  "Date",
  "Celebration",
  "Season",
  "Week",
  "Liturgical Year",
  "Weekday Cycle",
  "Liturgical Color",
  "Rank",
  "Holy Day of Obligation",
  "Saint",
  "Lectionary Number",
  "Notes",
];

const readingHeaders = [
  "Date",
  "Celebration",
  "First Reading Reference",
  "Responsorial Psalm Reference",
  "Psalm Response",
  "Second Reading Reference",
  "Gospel Acclamation",
  "Gospel Reference",
];

const validationHeaders = ["Liturgical Years", "Weekday Cycles", "Liturgical Colors", "Ranks", "Boolean"];

const validationLists = {
  "Liturgical Years": ["A", "B", "C"],
  "Weekday Cycles": ["I", "II"],
  "Liturgical Colors": ["green", "purple", "white", "red", "rose", "gold"],
  Ranks: ["weekday", "optional_memorial", "memorial", "feast", "solemnity", "sunday", "holy_day"],
  Boolean: ["true", "false"],
};

function toCalendarRow(row, metadata) {
  return [
    row.date,
    row.celebration,
    metadata.season,
    row.week,
    metadata.liturgicalYear,
    metadata.weekdayCycle,
    row.liturgicalColor,
    row.rank,
    row.holyDay === true,
    row.saint ?? "",
    row.lectionaryNumber,
    row.notes ?? "",
  ];
}

function toReadingRow(row) {
  return [
    row.date,
    row.celebration,
    row.first,
    row.psalm,
    row.psalmResponse ?? "",
    row.second ?? "",
    row.gospelAcclamation ?? "",
    row.gospel,
  ];
}

module.exports = {
  calendarHeaders,
  readingHeaders,
  validationHeaders,
  validationLists,
  toCalendarRow,
  toReadingRow,
};
