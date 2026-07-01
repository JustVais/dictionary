import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { LookupForm } from "@/components/translate/lookup-form";

export default async function TranslatePage() {
  const user = await requireUser();

  const rows = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(eq(folders.userId, user.id))
    .orderBy(folders.createdAt);

  return <LookupForm folders={rows} />;
}
