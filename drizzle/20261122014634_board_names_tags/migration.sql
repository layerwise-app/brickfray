ALTER TABLE `board_match` ADD `detail` text;--> statement-breakpoint
ALTER TABLE `board_profile` ADD `name_key` text;--> statement-breakpoint
ALTER TABLE `board_profile` ADD `tag` integer;--> statement-breakpoint
-- Names keep only what names.ts NAME_RANGES allows (empty: Player) and get name_key, their lower case as JS toLowerCase gives it.
WITH RECURSIVE allowed(lo, hi) AS (
  VALUES
    (46, 46), (48, 57), (65, 90), (97, 122), (192, 214), (216, 246), (248, 447), (452, 591),
    (4352, 4607), (7680, 7935), (12293, 12295), (12353, 12438), (12445, 12447), (12449, 12538), (12540, 12543), (12593, 12686),
    (12784, 12799), (13312, 19903), (19968, 40959), (44032, 55203), (63744, 64255), (131072, 205743)
), fold(c, lower) AS (
  VALUES
    (65, char(97)), (66, char(98)), (67, char(99)), (68, char(100)), (69, char(101)), (70, char(102)), (71, char(103)), (72, char(104)),
    (73, char(105)), (74, char(106)), (75, char(107)), (76, char(108)), (77, char(109)), (78, char(110)), (79, char(111)), (80, char(112)),
    (81, char(113)), (82, char(114)), (83, char(115)), (84, char(116)), (85, char(117)), (86, char(118)), (87, char(119)), (88, char(120)),
    (89, char(121)), (90, char(122)), (192, char(224)), (193, char(225)), (194, char(226)), (195, char(227)), (196, char(228)), (197, char(229)),
    (198, char(230)), (199, char(231)), (200, char(232)), (201, char(233)), (202, char(234)), (203, char(235)), (204, char(236)), (205, char(237)),
    (206, char(238)), (207, char(239)), (208, char(240)), (209, char(241)), (210, char(242)), (211, char(243)), (212, char(244)), (213, char(245)),
    (214, char(246)), (216, char(248)), (217, char(249)), (218, char(250)), (219, char(251)), (220, char(252)), (221, char(253)), (222, char(254)),
    (256, char(257)), (258, char(259)), (260, char(261)), (262, char(263)), (264, char(265)), (266, char(267)), (268, char(269)), (270, char(271)),
    (272, char(273)), (274, char(275)), (276, char(277)), (278, char(279)), (280, char(281)), (282, char(283)), (284, char(285)), (286, char(287)),
    (288, char(289)), (290, char(291)), (292, char(293)), (294, char(295)), (296, char(297)), (298, char(299)), (300, char(301)), (302, char(303)),
    (304, char(105) || char(775)), (306, char(307)), (308, char(309)), (310, char(311)), (313, char(314)), (315, char(316)), (317, char(318)), (319, char(320)),
    (321, char(322)), (323, char(324)), (325, char(326)), (327, char(328)), (330, char(331)), (332, char(333)), (334, char(335)), (336, char(337)),
    (338, char(339)), (340, char(341)), (342, char(343)), (344, char(345)), (346, char(347)), (348, char(349)), (350, char(351)), (352, char(353)),
    (354, char(355)), (356, char(357)), (358, char(359)), (360, char(361)), (362, char(363)), (364, char(365)), (366, char(367)), (368, char(369)),
    (370, char(371)), (372, char(373)), (374, char(375)), (376, char(255)), (377, char(378)), (379, char(380)), (381, char(382)), (385, char(595)),
    (386, char(387)), (388, char(389)), (390, char(596)), (391, char(392)), (393, char(598)), (394, char(599)), (395, char(396)), (398, char(477)),
    (399, char(601)), (400, char(603)), (401, char(402)), (403, char(608)), (404, char(611)), (406, char(617)), (407, char(616)), (408, char(409)),
    (412, char(623)), (413, char(626)), (415, char(629)), (416, char(417)), (418, char(419)), (420, char(421)), (422, char(640)), (423, char(424)),
    (425, char(643)), (428, char(429)), (430, char(648)), (431, char(432)), (433, char(650)), (434, char(651)), (435, char(436)), (437, char(438)),
    (439, char(658)), (440, char(441)), (444, char(445)), (452, char(454)), (453, char(454)), (455, char(457)), (456, char(457)), (458, char(460)),
    (459, char(460)), (461, char(462)), (463, char(464)), (465, char(466)), (467, char(468)), (469, char(470)), (471, char(472)), (473, char(474)),
    (475, char(476)), (478, char(479)), (480, char(481)), (482, char(483)), (484, char(485)), (486, char(487)), (488, char(489)), (490, char(491)),
    (492, char(493)), (494, char(495)), (497, char(499)), (498, char(499)), (500, char(501)), (502, char(405)), (503, char(447)), (504, char(505)),
    (506, char(507)), (508, char(509)), (510, char(511)), (512, char(513)), (514, char(515)), (516, char(517)), (518, char(519)), (520, char(521)),
    (522, char(523)), (524, char(525)), (526, char(527)), (528, char(529)), (530, char(531)), (532, char(533)), (534, char(535)), (536, char(537)),
    (538, char(539)), (540, char(541)), (542, char(543)), (544, char(414)), (546, char(547)), (548, char(549)), (550, char(551)), (552, char(553)),
    (554, char(555)), (556, char(557)), (558, char(559)), (560, char(561)), (562, char(563)), (570, char(11365)), (571, char(572)), (573, char(410)),
    (574, char(11366)), (577, char(578)), (579, char(384)), (580, char(649)), (581, char(652)), (582, char(583)), (584, char(585)), (586, char(587)),
    (588, char(589)), (590, char(591)), (7680, char(7681)), (7682, char(7683)), (7684, char(7685)), (7686, char(7687)), (7688, char(7689)), (7690, char(7691)),
    (7692, char(7693)), (7694, char(7695)), (7696, char(7697)), (7698, char(7699)), (7700, char(7701)), (7702, char(7703)), (7704, char(7705)), (7706, char(7707)),
    (7708, char(7709)), (7710, char(7711)), (7712, char(7713)), (7714, char(7715)), (7716, char(7717)), (7718, char(7719)), (7720, char(7721)), (7722, char(7723)),
    (7724, char(7725)), (7726, char(7727)), (7728, char(7729)), (7730, char(7731)), (7732, char(7733)), (7734, char(7735)), (7736, char(7737)), (7738, char(7739)),
    (7740, char(7741)), (7742, char(7743)), (7744, char(7745)), (7746, char(7747)), (7748, char(7749)), (7750, char(7751)), (7752, char(7753)), (7754, char(7755)),
    (7756, char(7757)), (7758, char(7759)), (7760, char(7761)), (7762, char(7763)), (7764, char(7765)), (7766, char(7767)), (7768, char(7769)), (7770, char(7771)),
    (7772, char(7773)), (7774, char(7775)), (7776, char(7777)), (7778, char(7779)), (7780, char(7781)), (7782, char(7783)), (7784, char(7785)), (7786, char(7787)),
    (7788, char(7789)), (7790, char(7791)), (7792, char(7793)), (7794, char(7795)), (7796, char(7797)), (7798, char(7799)), (7800, char(7801)), (7802, char(7803)),
    (7804, char(7805)), (7806, char(7807)), (7808, char(7809)), (7810, char(7811)), (7812, char(7813)), (7814, char(7815)), (7816, char(7817)), (7818, char(7819)),
    (7820, char(7821)), (7822, char(7823)), (7824, char(7825)), (7826, char(7827)), (7828, char(7829)), (7838, char(223)), (7840, char(7841)), (7842, char(7843)),
    (7844, char(7845)), (7846, char(7847)), (7848, char(7849)), (7850, char(7851)), (7852, char(7853)), (7854, char(7855)), (7856, char(7857)), (7858, char(7859)),
    (7860, char(7861)), (7862, char(7863)), (7864, char(7865)), (7866, char(7867)), (7868, char(7869)), (7870, char(7871)), (7872, char(7873)), (7874, char(7875)),
    (7876, char(7877)), (7878, char(7879)), (7880, char(7881)), (7882, char(7883)), (7884, char(7885)), (7886, char(7887)), (7888, char(7889)), (7890, char(7891)),
    (7892, char(7893)), (7894, char(7895)), (7896, char(7897)), (7898, char(7899)), (7900, char(7901)), (7902, char(7903)), (7904, char(7905)), (7906, char(7907)),
    (7908, char(7909)), (7910, char(7911)), (7912, char(7913)), (7914, char(7915)), (7916, char(7917)), (7918, char(7919)), (7920, char(7921)), (7922, char(7923)),
    (7924, char(7925)), (7926, char(7927)), (7928, char(7929)), (7930, char(7931)), (7932, char(7933)), (7934, char(7935))
), walk(id, rest, c, name, name_key) AS (
  SELECT id, name, unicode(name), '', '' FROM board_profile
  UNION ALL
  SELECT walk.id, substr(walk.rest, 2), unicode(substr(walk.rest, 2)),
    walk.name || CASE WHEN allowed.lo IS NULL THEN '' ELSE char(walk.c) END,
    walk.name_key || CASE WHEN allowed.lo IS NULL THEN '' ELSE coalesce(fold.lower, char(walk.c)) END
  FROM walk
  LEFT JOIN allowed ON walk.c BETWEEN allowed.lo AND allowed.hi
  LEFT JOIN fold ON fold.c = walk.c
  WHERE walk.rest <> ''
), clean AS (
  SELECT id, name, name_key FROM walk WHERE rest = ''
)
UPDATE board_profile
SET name = CASE WHEN clean.name = '' THEN 'Player' ELSE clean.name END,
  name_key = CASE WHEN clean.name = '' THEN 'player' ELSE clean.name_key END
FROM clean
WHERE clean.id = board_profile.id;--> statement-breakpoint
-- Tags for existing profiles: within one name_key, row n (oldest first) takes 1000 + (7919n + b) mod 9000, a bijection on
-- 0..8999 (7919 is prime to 9000) with b fixed per name, so no two rows of a name collide; past 9000 rows, five digits.
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY name_key ORDER BY created_at, rowid) - 1 AS n,
    MIN(rowid) OVER (PARTITION BY name_key) AS first
  FROM board_profile
)
UPDATE board_profile
SET tag = CASE WHEN numbered.n < 9000 THEN 1000 + (numbered.n * 7919 + numbered.first * 4271) % 9000 ELSE 1000 + numbered.n END
FROM numbered
WHERE numbered.id = board_profile.id;--> statement-breakpoint
-- A profile without a picture keeps the portrait of the character it played last (any character when it has no match).
UPDATE board_profile
SET avatar_hero = coalesce(
  (SELECT m.character FROM board_match m WHERE m.profile_id = board_profile.id ORDER BY m.ended_at DESC, m.id DESC LIMIT 1),
  CASE rowid % 6 WHEN 0 THEN 'rivet' WHEN 1 THEN 'vega' WHEN 2 THEN 'clack' WHEN 3 THEN 'coral' WHEN 4 THEN 'moss' ELSE 'nova' END
)
WHERE avatar_hero IS NULL AND avatar_image IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `board_match_rank_idx`;--> statement-breakpoint
CREATE INDEX `board_match_board_idx` ON `board_match` (`mode`,`difficulty`,`map`);--> statement-breakpoint
CREATE UNIQUE INDEX `board_profile_name_tag_uq` ON `board_profile` (`name_key`,`tag`);