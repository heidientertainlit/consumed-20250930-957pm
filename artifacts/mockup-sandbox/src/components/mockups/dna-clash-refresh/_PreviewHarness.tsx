import type { ReactNode } from "react";
import type { ClashUser } from "./_BaselineSource";
import { getFixtureCase, POSTER_URL } from "./fixture-data";
import "./fetch-boundary";

type CardProps = {
  user1: ClashUser;
  user2: ClashUser;
  mediaTitle: string;
  mediaType: string;
  posterUrl: string;
  currentUserId?: string;
  session?: { access_token: string; user?: { id: string } } | null;
  poolId: string;
};

export default function PreviewHarness({
  label,
  children,
}: {
  label: string;
  children: (props: CardProps) => ReactNode;
}) {
  const fixtureCase = getFixtureCase();
  const isGuest = fixtureCase === "guest";
  const session = isGuest ? null : {
    access_token: "local-fixture-session",
    user: { id: "fixture-amber" },
  };
  const user1: ClashUser = {
    displayName: "Amber Morgan",
    username: "amber.m",
    userId: "fixture-amber",
    dnaLabel: "The Theory Crafter",
    rating: 5,
    initials: "AM",
    color: "violet",
    votes: 0,
  };
  const user2: ClashUser = {
    displayName: "Kimberly Wells",
    username: "kimberly.w",
    userId: "fixture-kimberly",
    dnaLabel: "The Theory Crafter",
    rating: 1,
    initials: "KW",
    color: "violet",
    votes: 0,
  };
  const mediaTitle = fixtureCase === "long-title"
    ? "The Lord of the Rings: The Fellowship of the Ring — Extended Edition"
    : "The Lord of the Rings: The Fellowship of the Ring";

  return (
    <main className="dna-clash-fixture-page px-3 py-5 sm:px-5">
      <div className="mx-auto mb-3 flex max-w-[620px] flex-wrap items-center justify-between gap-2 text-[11px] text-[#746a79]">
        <span>{label}</span>
        <label className="flex items-center gap-2">
          Local state
          <select
            aria-label="DNA Clash fixture state"
            defaultValue={fixtureCase}
            onChange={(event) => {
              const url = new URL(window.location.href);
              url.searchParams.set("case", event.target.value);
              window.location.assign(url.toString());
            }}
            className="min-h-9 rounded-lg border border-[#d9cedf] bg-white px-2 text-[#4a3a52]"
          >
            {["reference", "zero", "participant", "long-title", "guest"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mx-auto w-full max-w-[620px]">
        {children({
          user1,
          user2,
          mediaTitle,
          mediaType: "movie",
          posterUrl: POSTER_URL,
          currentUserId: fixtureCase === "participant" ? user1.userId : undefined,
          session,
          poolId: `local-fixture-${fixtureCase}`,
        })}
      </div>
    </main>
  );
}
