import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const raw = readFileSync("/Users/adviciya/Documents/react/uno-online/.env", "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let [, key, value] = m;
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  process.env[key] = value;
}
const projectId = process.env.FIREBASE_PROJECT_ID;
const auth = new GoogleAuth({
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;
const res = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/rooms/indexes`,
  { headers: { Authorization: `Bearer ${token}` } },
);
console.log("Status:", res.status);
console.log(JSON.stringify(await res.json(), null, 2));
