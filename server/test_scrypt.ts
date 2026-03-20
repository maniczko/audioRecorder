import crypto from "node:crypto";

const salt = "51fe9d2c0241419370bd36424eb03563";
const pass = "haslo123";
const derived = crypto.scryptSync(pass, salt, 64).toString("hex");
console.log("Derived length:", derived.length);
console.log("Derived:", derived);
