CREATE TABLE `board_avatar` (
	`id` text PRIMARY KEY,
	`profile_id` text NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_board_avatar_profile_id_board_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `board_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_match` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`player_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`match_key` text NOT NULL,
	`mode` text NOT NULL,
	`map` text NOT NULL,
	`difficulty` text,
	`wave` integer NOT NULL,
	`character` text NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_s` integer NOT NULL,
	`score` integer NOT NULL,
	`kills` integer NOT NULL,
	`deaths` integer NOT NULL,
	`assists` integer NOT NULL,
	`headshots` integer NOT NULL,
	`placement` integer NOT NULL,
	`players` integer NOT NULL,
	`result` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_board_match_player_id_board_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `board_player`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_board_match_profile_id_board_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `board_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_player` (
	`id` text PRIMARY KEY,
	`profile_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT `fk_board_player_profile_id_board_profile_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `board_profile`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_profile` (
	`id` text PRIMARY KEY,
	`user_id` text UNIQUE,
	`name` text NOT NULL,
	`avatar_hero` text,
	`avatar_image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_board_profile_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `board_rate` (
	`key` text NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL,
	CONSTRAINT `board_rate_pk` PRIMARY KEY(`key`, `window`)
);
--> statement-breakpoint
CREATE INDEX `board_avatar_profile_idx` ON `board_avatar` (`profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `board_match_player_key_uq` ON `board_match` (`player_id`,`match_key`);--> statement-breakpoint
CREATE INDEX `board_match_rank_idx` ON `board_match` (`mode`,`ended_at`);--> statement-breakpoint
CREATE INDEX `board_match_profile_idx` ON `board_match` (`profile_id`,`ended_at`);--> statement-breakpoint
CREATE INDEX `board_player_profile_idx` ON `board_player` (`profile_id`);