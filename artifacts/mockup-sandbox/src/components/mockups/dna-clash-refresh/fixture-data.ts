export type FixtureCase = "reference" | "zero" | "participant" | "long-title" | "guest";

export const POSTER_URL =
  "https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg";

export function getFixtureCase(): FixtureCase {
  const value = new URLSearchParams(window.location.search).get("case");
  if (value === "zero" || value === "participant" || value === "long-title" || value === "guest") {
    return value;
  }
  return "reference";
}

export function getFixtureVotes() {
  const fixtureCase = getFixtureCase();
  if (fixtureCase === "zero" || fixtureCase === "guest") return [];
  if (fixtureCase === "participant") {
    return [
      { user_id: "fixture-amber", prediction: "amber.m" },
      { user_id: "fixture-preview-2", prediction: "kimberly.w" },
    ];
  }
  return [
    { user_id: "fixture-preview-1", prediction: "amber.m" },
    { user_id: "fixture-preview-2", prediction: "amber.m" },
  ];
}

export const fixtureProfiles = [
  { id: "fixture-amber", display_name: "Amber Morgan", user_name: "amber.m" },
  { id: "fixture-kimberly", display_name: "Kimberly Wells", user_name: "kimberly.w" },
  { id: "fixture-preview-1", display_name: "Preview Voter One", user_name: "preview.one" },
  { id: "fixture-preview-2", display_name: "Preview Voter Two", user_name: "preview.two" },
];
