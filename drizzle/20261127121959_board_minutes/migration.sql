ALTER TABLE `board_match` ADD `minutes` integer;--> statement-breakpoint
DROP INDEX `board_match_board_idx`;--> statement-breakpoint
CREATE INDEX `board_match_board_idx` ON `board_match` (`mode`,`difficulty`,`minutes`,`map`);