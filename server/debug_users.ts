import { getDatabase } from "./database.ts";

async function check() {
  const db = getDatabase();
  await db.init();
  const users = await db._query("SELECT email, provider, password_hash FROM users");
  console.log("Users in DB:", users);
  process.exit(0);
}

check();
