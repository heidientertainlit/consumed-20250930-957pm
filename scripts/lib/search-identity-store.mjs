// Development-only PostgreSQL fixture. Never reads environment connection strings.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";

export const fixtureUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "search-fixture@example.invalid", user_name: "search-fixture",
};
export const fixtureList = "20000000-0000-4000-8000-000000000001";
const identifier = value => {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw Error(`Invalid fixture identifier: ${value}`);
  return `"${value}"`;
};
const jsonColumns = new Set(["fingerprint", "source_metadata", "metadata", "data"]);
const parameter = (key, value) => jsonColumns.has(key) && value !== null ? JSON.stringify(value) : value;

class Query {
  filters = []; operation = "select"; payload; conflict; shape; countOnly = false;
  constructor(store, table) { this.store = store; this.table = table; }
  select(_fields, options) { this.countOnly = options?.head === true; return this; }
  eq(key, value) { this.filters.push([key, value]); return this; }
  is(key, value) { return this.eq(key, value); }
  limit(value) { this.max = value; return this; }
  order(key, { ascending = true } = {}) { this.sort = [key, ascending]; return this; }
  insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload) { this.operation = "update"; this.payload = payload; return this; }
  upsert(payload, options) {
    this.operation = "insert"; this.payload = payload;
    this.conflict = (options?.onConflict || "id").split(","); return this;
  }
  delete() { this.operation = "delete"; return this; }
  single() { this.shape = "single"; return this.execute(); }
  maybeSingle() { this.shape = "maybe"; return this.execute(); }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    this.store.operations.push({ table: this.table, operation: this.operation });
    const values = [];
    const bind = (key, value) => { values.push(parameter(key, value)); return `$${values.length}`; };
    const table = identifier(this.table);
    let sql;
    if (this.operation === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keys = [...new Set(rows.flatMap(Object.keys))];
      sql = `insert into ${table} (${keys.map(identifier)}) values ` + rows.map(row =>
        `(${keys.map(key => key in row ? bind(key, row[key]) : "default")})`).join(",");
      if (this.conflict) sql += ` on conflict (${this.conflict.map(identifier)}) do update set ` +
        keys.filter(key => !this.conflict.includes(key)).map(key => `${identifier(key)}=excluded.${identifier(key)}`).join(",");
      sql += " returning *";
    } else {
      sql = this.operation === "select" ? `select * from ${table}` :
        this.operation === "delete" ? `delete from ${table}` :
          `update ${table} set ` + Object.entries(this.payload).map(([key, value]) => `${identifier(key)}=${bind(key, value)}`);
      if (this.filters.length) sql += " where " + this.filters.map(([key, value]) =>
        `${identifier(key)} is not distinct from ${bind(key, value)}`).join(" and ");
      if (this.operation === "select") {
        if (this.sort) sql += ` order by ${identifier(this.sort[0])} ${this.sort[1] ? "asc" : "desc"}`;
        if (this.max !== undefined) sql += ` limit ${Number(this.max)}`;
      } else sql += " returning *";
    }
    try {
      const { rows } = await this.store.pool.query(sql, values);
      if (this.shape && (rows.length > 1 || (this.shape === "single" && !rows.length))) {
        return { data: null, error: { code: "PGRST116", message: "Fixture expected one row" } };
      }
      return { data: this.countOnly ? null : this.shape ? rows[0] || null : rows, error: null, count: rows.length };
    } catch (error) {
      this.store.errors.push({ table: this.table, code: error.code, message: error.message });
      return { data: null, error: { code: error.code, message: error.message } };
    }
  }
}

export async function createSearchIdentityStore() {
  const directory = await mkdtemp(join(tmpdir(), "search-identity-pg-"));
  const data = join(directory, "data");
  const run = (binary, args) => execFileSync(binary, args, { stdio: "pipe" });
  let pool, started = false;
  try {
    run("initdb", ["-D", data, "--auth-local=trust", "--auth-host=reject", "--no-locale", "-E", "UTF8"]);
    // No TCP listener; the private temporary directory contains the Unix socket.
    run("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-o",
      `-k ${directory} -c listen_addresses='' -c fsync=off`, "-w", "start"]);
    started = true;
    pool = new pg.Pool({ host: directory, database: "postgres", user: userInfo().username, max: 8 });
    await pool.query(await readFile(new URL("../fixtures/search-identity-schema.sql", import.meta.url), "utf8"));
    const migration = await readFile("supabase/migrations/20260830030000_create_canonical_media_identity.sql", "utf8");
    // Use the real canonical tables/RPC/triggers, never the historical data repair.
    await pool.query(migration.slice(0, migration.indexOf("-- Targeted compatibility repair")));
    await pool.query(migration.slice(migration.indexOf("create unique index if not exists canonical_media_verified_title_creator_year_unique")));
    await pool.query(`create unique index on media_ratings(user_id,canonical_media_id);
      create unique index on list_items(user_id,list_id,canonical_media_id);`);
    const store = {
      pool, operations: [], errors: [], failBatch: false,
      from(table) { return new Query(this, table); },
      auth: { getUser: async () => ({ data: { user: fixtureUser }, error: null }) },
      async rpc(name, args) {
        this.operations.push({ table: name, operation: "rpc", count: args?.p_items?.length });
        if (name !== "resolve_media_canonical_batch") throw Error(`Unsupported fixture RPC: ${name}`);
        if (this.failBatch) return { data: null, error: { message: "Isolated RPC failure" } };
        const { rows } = await pool.query("select * from resolve_media_canonical_batch($1::jsonb)", [JSON.stringify(args.p_items)]);
        return { data: rows, error: null };
      },
      async reset() {
        await pool.query(`truncate users,lists,list_items,media_ratings,social_posts,
          media_fingerprints,media_provider_aliases,canonical_media restart identity cascade`);
        await pool.query("insert into users(id,email,user_name) values($1,$2,$3)", Object.values(fixtureUser));
        for (const [index, title] of ["Currently", "Want To", "Finished", "Did Not Finish", "Favorites"].entries()) {
          await pool.query("insert into lists(id,user_id,title) values($1,$2,$3)", [
            index === 0 ? fixtureList : `20000000-0000-4000-8000-00000000000${index + 1}`, fixtureUser.id, title,
          ]);
        }
        this.operations = []; this.errors = []; this.failBatch = false;
      },
      async close() {
        await pool.end();
        run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
        started = false;
        await rm(directory, { recursive: true, force: true });
      },
    };
    await store.reset();
    return store;
  } catch (error) {
    await pool?.end();
    if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
