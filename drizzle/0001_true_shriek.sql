CREATE TABLE `player_progress` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` integer NOT NULL
);
