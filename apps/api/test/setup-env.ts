// Loaded before every e2e test file. Points the app at the dedicated
// kmeets_test database (never kmeets_dev) and forces every third-party
// integration to its mock adapter — e2e tests never touch a real vendor.
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
