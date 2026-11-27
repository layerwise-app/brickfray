-- Room matches stored before time limits were kept: the shortest limit their played time fits (play is timed from the
-- warm-up's end, so a match that ran its clock out lasts its limit; one ended by the kill limit is shorter).
UPDATE `board_match` SET `minutes` = CASE
  WHEN `duration_s` <= 195 THEN 3
  WHEN `duration_s` <= 315 THEN 5
  WHEN `duration_s` <= 615 THEN 10
  ELSE 15
END
WHERE `minutes` IS NULL AND `mode` IN ('ffa', 'tdm');
