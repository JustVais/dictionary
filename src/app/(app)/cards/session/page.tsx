import { notFound } from "next/navigation";
import { getDueWords } from "../actions";
import { ReviewSession } from "@/components/cards/review-session";

export default async function ReviewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ folderId?: string; mode?: string }>;
}) {
  const { folderId, mode } = await searchParams;

  if (!folderId && mode !== "all") notFound();

  const { words: dueWords, aheadOfSchedule } = await getDueWords(
    mode === "all" ? { all: true } : { folderId: folderId! }
  );

  return (
    <ReviewSession initialWords={dueWords} aheadOfSchedule={aheadOfSchedule} />
  );
}
