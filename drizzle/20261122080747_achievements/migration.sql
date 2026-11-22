CREATE TABLE `board_stat` (
	`player_id` text NOT NULL,
	`stat` text NOT NULL,
	`value` integer NOT NULL,
	CONSTRAINT `board_stat_pk` PRIMARY KEY(`player_id`, `stat`),
	CONSTRAINT `fk_board_stat_player_id_board_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `board_player`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_unlock` (
	`profile_id` text NOT NULL,
	`achievement` text NOT NULL,
	`tier` integer NOT NULL,
	`unlocked_at` integer NOT NULL,
	CONSTRAINT `board_unlock_pk` PRIMARY KEY(`profile_id`, `achievement`, `tier`),
	CONSTRAINT `fk_board_unlock_profile_id_board_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `board_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `board_match` ADD `tally` text;--> statement-breakpoint
ALTER TABLE `board_match` ADD `counted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `board_match_uncounted_idx` ON `board_match` (`profile_id`) WHERE "board_match"."counted" = 0;