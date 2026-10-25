import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const watchState = sqliteTable("watch_state", {id:text("id").primaryKey(),payload:text("payload").notNull(),revision:integer("revision").notNull().default(0)});
