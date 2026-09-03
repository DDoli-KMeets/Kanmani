/**
 * Dev-convenience seed script: creates a first Super Admin account and a
 * handful of interests so a fresh database isn't completely empty. Run with
 * `pnpm db:seed` after `pnpm db:migrate`.
 *
 * This is NOT how you'd bootstrap a production admin — for that, connect to
 * the production database directly (e.g. via your cloud provider's console)
 * and run the same kind of UPDATE this script does, once, for your own
 * phone number. See docs/DEPLOYMENT.md.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, closeDb, schema } from "./client";

const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "+919999999999";

async function main() {
  const db = getDb();

  const [existingAdmin] = await db.select().from(schema.users).where(eq(schema.users.phone, ADMIN_PHONE)).limit(1);
  if (existingAdmin) {
    await db.update(schema.users).set({ role: "SUPER_ADMIN" }).where(eq(schema.users.id, existingAdmin.id));
    console.log(`Existing user ${ADMIN_PHONE} promoted to SUPER_ADMIN.`);
  } else {
    await db.insert(schema.users).values({
      phone: ADMIN_PHONE,
      phoneVerifiedAt: new Date(),
      name: "Admin",
      role: "SUPER_ADMIN",
    });
    console.log(`Created SUPER_ADMIN user for ${ADMIN_PHONE}.`);
  }
  console.log(
    `Sign in as this admin by requesting an OTP for ${ADMIN_PHONE} — with SMS_PROVIDER=mock ` +
      "the code is printed in the API's console log instead of being texted.",
  );

  const seedInterests = [
    ["Hiking & Trails", "outdoors"],
    ["Books & Reading", "culture"],
    ["Startups & Business", "work"],
    ["Music", "culture"],
    ["Food & Cooking", "lifestyle"],
    ["Movies & TV", "culture"],
    ["Fitness", "lifestyle"],
    ["Travel", "lifestyle"],
    ["Art & Design", "culture"],
    ["Tech & Gadgets", "work"],
  ] as const;

  for (const [name, category] of seedInterests) {
    const [existing] = await db.select().from(schema.interests).where(eq(schema.interests.name, name)).limit(1);
    if (!existing) {
      await db.insert(schema.interests).values({ name, category });
    }
  }
  console.log(`Seeded ${seedInterests.length} interests (skipping any that already existed).`);

  await closeDb();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
