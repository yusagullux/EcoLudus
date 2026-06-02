// @ts-nocheck
import { readdir, readFile } from "fs/promises";
import path from "path";
import { pool } from "../lib/db";

async function main() {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    process.stdout.write(`Applying ${file}...\n`);
    await pool.query(sql);
  }

  process.stdout.write("Migrations complete.\n");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
