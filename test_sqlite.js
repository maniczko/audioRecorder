try {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
  db.prepare("INSERT INTO test (name) VALUES (?)").run("Hello");
  const row = db.prepare("SELECT * FROM test").get();
  console.log("node:sqlite SUCCESS:", row);
} catch (e) {
  console.error("node:sqlite FAILED:", e.message);
}
