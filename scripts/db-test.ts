import { sql } from "../lib/db";

async function main() {
  console.log("Testing db mode...");
  try {
    const res = await sql("select 1 as ok");
    console.log("Result:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}

main();
