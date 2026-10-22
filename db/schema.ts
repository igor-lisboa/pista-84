import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('control_rooms',{
 id:text('id').primaryKey(),hostToken:text('host_token').notNull(),joinToken:text('join_token').notNull(),
 offer:text('offer').notNull(),answer:text('answer'),expires:integer('expires').notNull(),
 input:text('input'),inputTime:integer('input_time').notNull().default(0)
});
export const progress=sqliteTable('player_progress',{
 userId:text('user_id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull(),updated:integer('updated').notNull()
});
