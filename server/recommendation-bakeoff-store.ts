import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import type { PrivateTrial } from "./recommendation-bakeoff-core";

// Evaluation data only, outside the Vite-served workspace. Never a recommendation cache.
export const BAKEOFF_DIRECTORY = path.join(os.homedir(), ".local", "state",
  "consumed-bakeoff-" + createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12));
type State = { version: 1; trials: PrivateTrial[] };
export function createBakeoffStore(directory = BAKEOFF_DIRECTORY) {
  let queue: Promise<unknown> = Promise.resolve();
  return async function transaction<T>(fn: (state: State) => Promise<{ value: T; write?: boolean }>): Promise<T> {
    const task = queue.then(async () => {
      const file = path.join(directory, "evaluations.json");
      let state: State;
      try {
        state = JSON.parse(await fs.readFile(file, "utf8"));
        if (state.version !== 1 || !Array.isArray(state.trials)) throw new Error("Unsupported bake-off storage format.");
        // Preserve earlier human judgments; the former Fine choice is now unsure.
        for (const trial of state.trials) for (const column of trial.columns) for (const rating of Object.values(column.ratings)) {
          const legacy = rating as { verdict: string | null };
          if (legacy.verdict === "great") legacy.verdict = "good";
          if (legacy.verdict === "fine") legacy.verdict = null;
        }
      } catch (e: any) { if (e.code === "ENOENT") state = { version: 1, trials: [] }; else throw e; }
      const result = await fn(state);
      if (result.write) {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        await fs.writeFile(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
        await fs.rename(file + ".tmp", file);
      }
      return result.value;
    });
    queue = task.catch(() => undefined);
    return task;
  };
}
