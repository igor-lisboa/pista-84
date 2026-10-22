CREATE TABLE `control_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`host_token` text NOT NULL,
	`join_token` text NOT NULL,
	`offer` text NOT NULL,
	`answer` text,
	`expires` integer NOT NULL
);
