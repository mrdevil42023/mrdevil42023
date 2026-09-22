/**
 * Generate a self-contained, AMOLED-black GitHub contribution calendar SVG.
 *
 * No npm dependencies are required. Run with Node 20+:
 *   PROFILE_USERNAME=mrdevil42023 GH_TOKEN=... node generate.js
 *
 * GitHub Actions supplies GH_TOKEN automatically from secrets.GITHUB_TOKEN.
 */

const fs = require("node:fs");
const path = require("node:path");

const username = process.env.PROFILE_USERNAME || "mrdevil42023";
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outputPath = path.join(
  process.env.OUTPUT_DIR || "output",
  "contribution-calendar.svg",
);

if (!token) {
  throw new Error(
    "Missing GH_TOKEN. Set GH_TOKEN locally or run this script through GitHub Actions.",
  );
}

const COLORS = {
  background: "#000000",
  panel: "#050505",
  empty: "#161616",
  low: "#5b0b0b",
  medium: "#a61111",
  high: "#d71919",
  highest: "#ff2020",
  text: "#ffffff",
  muted: "#777777",
  border: "#242424",
};

const CELL_SIZE = 12;
const CELL_GAP = 4;
const STEP = CELL_SIZE + CELL_GAP;
const LEFT = 34;
const TOP = 38;
const BOTTOM = 36;
const RIGHT = 16;
const RADIUS = 2;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function githubContributions() {
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  // The calendar needs complete Sunday-to-Saturday columns.
  const calendarEnd = addDays(end, 6 - end.getUTCDay());
  const calendarStart = addDays(calendarEnd, -7 * 52);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalRepositoryContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-contribution-calendar",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: username,
        from: `${isoDate(calendarStart)}T00:00:00Z`,
        to: `${isoDate(calendarEnd)}T23:59:59Z`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!payload.data?.user) {
    throw new Error(`GitHub user "${username}" was not found.`);
  }

  return {
    calendar: payload.data.user.contributionsCollection.contributionCalendar,
    start: calendarStart,
    end: calendarEnd,
  };
}

function levelFor(count, max) {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function colorFor(level) {
  return [COLORS.empty, COLORS.low, COLORS.medium, COLORS.high, COLORS.highest][
    level
  ];
}

function renderSvg(calendar, start, end) {
  const days = calendar.weeks.flatMap((week) => week.contributionDays);
  const max = Math.max(...days.map((day) => day.contributionCount), 1);
  const weeks = Math.floor((end - start) / 86400000 / 7) + 1;
  const gridWidth = weeks * STEP - CELL_GAP;
  const width = LEFT + gridWidth + RIGHT;
  const height = TOP + 7 * STEP - CELL_GAP + BOTTOM;

  const monthLabels = [];
  let previousMonth = -1;
  for (let column = 0; column < weeks; column += 1) {
    const date = addDays(start, column * 7);
    const month = date.getUTCMonth();
    if (month !== previousMonth) {
      monthLabels.push({
        x: LEFT + column * STEP,
        label: MONTH_LABELS[month],
      });
      previousMonth = month;
    }
  }

  const cells = days
    .map((day) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      const column = Math.floor((date - start) / 86400000 / 7);
      const row = date.getUTCDay();
      if (column < 0 || column >= weeks) return "";
      const x = LEFT + column * STEP;
      const y = TOP + row * STEP;
      const count = day.contributionCount;
      return `
    <rect x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}"
      fill="${colorFor(levelFor(count, max))}">
      <title>${escapeXml(day.date)} — ${count} contribution${count === 1 ? "" : "s"}</title>
    </rect>`;
    })
    .join("");

  const total = calendar.totalContributions.toLocaleString();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const monthText = monthLabels
    .map(
      ({ x, label }) =>
        `<text x="${x}" y="18" class="month">${label}</text>`,
    )
    .join("");
  const dayText = DAY_LABELS.map((label, row) =>
    label
      ? `<text x="0" y="${TOP + row * STEP + 10}" class="day">${label}</text>`
      : "",
  ).join("");

  const legendX = width - 5 * STEP - 70;
  const legend = [0, 1, 2, 3, 4]
    .map(
      (level, index) =>
        `<rect x="${legendX + index * STEP}" y="${height - 20}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="${colorFor(level)}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} contribution calendar</title>
  <desc id="desc">${total} contributions from ${escapeXml(startLabel)} to ${escapeXml(endLabel)}.</desc>
  <style>
    .month, .day, .summary, .legend { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .month { fill: ${COLORS.muted}; font-size: 10px; }
    .day { fill: ${COLORS.muted}; font-size: 9px; }
    .summary { fill: ${COLORS.text}; font-size: 12px; font-weight: 600; letter-spacing: .4px; }
    .legend { fill: ${COLORS.muted}; font-size: 9px; }
  </style>
  <rect width="${width}" height="${height}" rx="8" fill="${COLORS.background}" stroke="${COLORS.border}"/>
  <text x="16" y="18" class="summary">${escapeXml(total)} contributions</text>
  ${monthText}
  ${dayText}
  <g aria-label="Contribution grid">${cells}
  </g>
  <text x="${legendX - 28}" y="${height - 10}" class="legend">Less</text>
  ${legend}
  <text x="${legendX + 5 * STEP + 2}" y="${height - 10}" class="legend">More</text>
</svg>
`;
}

async function main() {
  const { calendar, start, end } = await githubContributions();
  const svg = renderSvg(calendar, start, end);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, svg);
  console.log(
    `Wrote ${outputPath} for ${username} (${calendar.totalContributions} contributions).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
