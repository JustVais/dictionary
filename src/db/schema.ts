import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const reviewResultEnum = pgEnum("review_result", [
  "remembered",
  "not_remembered",
]);

export const reviewGradeEnum = pgEnum("review_grade", [
  "again",
  "hard",
  "good",
  "easy",
]);

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const folders = pgTable(
  "folders",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("folders_user_id_idx").on(t.userId)]
);

export const words = pgTable(
  "words",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Denormalized alongside folderId so "Study All" can query every word
    // for a user without joining through folders.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    definition: text("definition"),
    partOfSpeech: text("part_of_speech"),
    example: text("example"),
    phoneticText: text("phonetic_text"),
    rememberedCount: integer("remembered_count").notNull().default(0),
    notRememberedCount: integer("not_remembered_count").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // FSRS card state (ts-fsrs): stability/difficulty are the memory model,
    // state is the ts-fsrs State enum (0 New, 1 Learning, 2 Review,
    // 3 Relearning), learningSteps is the position within the
    // (re)learning steps.
    fsrsStability: real("fsrs_stability").notNull().default(0),
    fsrsDifficulty: real("fsrs_difficulty").notNull().default(0),
    fsrsState: integer("fsrs_state").notNull().default(0),
    fsrsLearningSteps: integer("fsrs_learning_steps").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("words_user_next_review_idx").on(t.userId, t.nextReviewAt),
    index("words_folder_next_review_idx").on(t.folderId, t.nextReviewAt),
    index("words_folder_id_idx").on(t.folderId),
  ]
);

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    wordId: uuid("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    // Denormalized so Stats queries don't need to join through words.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    result: reviewResultEnum("result").notNull(),
    // Exact FSRS grade; null on rows logged before the FSRS migration.
    grade: reviewGradeEnum("grade"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("review_logs_user_reviewed_idx").on(t.userId, t.reviewedAt),
    index("review_logs_word_id_idx").on(t.wordId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  folders: many(folders),
  words: many(words),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, { fields: [folders.userId], references: [users.id] }),
  words: many(words),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
  user: one(users, { fields: [words.userId], references: [users.id] }),
  folder: one(folders, { fields: [words.folderId], references: [folders.id] }),
  reviewLogs: many(reviewLogs),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  word: one(words, { fields: [reviewLogs.wordId], references: [words.id] }),
  user: one(users, { fields: [reviewLogs.userId], references: [users.id] }),
}));
