-- Seed Golden Globes 2026 (83rd Annual) Nominations
-- Source: https://goldenglobes.com/nominations/2026

-- Insert the event
INSERT INTO awards_events (id, slug, name, year, ceremony_date, deadline, status, description, points_per_correct)
VALUES (
  'gg-2026',
  'golden-globes-2026',
  'Golden Globes',
  2026,
  '2026-01-11 20:00:00+00', -- January 11, 2026 at 8PM ET
  '2026-01-11 19:00:00+00', -- Deadline 1 hour before show
  'open',
  'The 83rd Annual Golden Globe Awards streaming live Sunday, January 11, 2026.',
  20
) ON CONFLICT (slug) DO UPDATE SET
  ceremony_date = EXCLUDED.ceremony_date,
  deadline = EXCLUDED.deadline,
  status = EXCLUDED.status;

-- Categories and Nominees

-- 1. Best Motion Picture - Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-picture-drama', 'gg-2026', 'Best Motion Picture - Drama', 'Picture (Drama)', 1)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-picture-drama', 'Frankenstein', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22740_Frankenstein_PosterArt.jpg?w=500', 1),
('cat-gg26-picture-drama', 'Hamnet', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28113_Hamnet_PosterArt.jpg?w=500', 2),
('cat-gg26-picture-drama', 'It Was Just an Accident', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27488_ItWasJustanAccident_PosterArt.png?w=500', 3),
('cat-gg26-picture-drama', 'Sentimental Value', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26566_SentimentalValue_PosterArt.jpg?w=500', 4),
('cat-gg26-picture-drama', 'Sinners', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_24147_Sinners_PosterArt.jpg?w=500', 5),
('cat-gg26-picture-drama', 'The Secret Agent', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27489_SecretAgentThe_PosterArt.jpg?w=500', 6);

-- 2. Best Motion Picture - Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-picture-comedy', 'gg-2026', 'Best Motion Picture - Musical or Comedy', 'Picture (Comedy)', 2)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-picture-comedy', 'Blue Moon', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22433_BlueMoon_PosterArt.jpg?w=500', 1),
('cat-gg26-picture-comedy', 'Bugonia', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28112_Bugonia_PosterArt.jpg?w=500', 2),
('cat-gg26-picture-comedy', 'Marty Supreme', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_24672_MartySupreme_PosterArt.jpg?w=500', 3),
('cat-gg26-picture-comedy', 'No Other Choice', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_29014_106_NoOtherChoice_LeeByunHun_Mansu_Character.jpg?w=500', 4),
('cat-gg26-picture-comedy', 'Nouvelle Vague', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22750_NouvelleVague_PosterArt.jpg?w=500', 5),
('cat-gg26-picture-comedy', 'One Battle After Another', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26672_OneBattleAfterAnother_PosterArt.jpg?w=500', 6);

-- 3. Best Motion Picture - Animated
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-animated', 'gg-2026', 'Best Motion Picture - Animated', 'Animated', 3)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-animated', 'Arco', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27492_Arco_CoverArt.jpg?w=500', 1),
('cat-gg26-animated', 'Demon Slayer: Kimetsu no Yaiba – Infinity Castle', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_23544_DemonSlayerKimetsunoYaibaInfinityCastle_PosterArt.png?w=500', 2),
('cat-gg26-animated', 'Elio', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28711_Elio_PosterArt.jpg?w=500', 3),
('cat-gg26-animated', 'KPop Demon Hunters', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22746_KPopDemonHunters_PosterArt.jpg?w=500', 4),
('cat-gg26-animated', 'Little Amélie or the Character of Rain', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22832_LittleAmelieortheCharacterofRain_PosterArt.jpg?w=500', 5),
('cat-gg26-animated', 'Zootopia 2', NULL, 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28712_Zootopia2_PosterArt.jpg?w=500', 6);

-- 4. Best Motion Picture – Non-English Language
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-foreign', 'gg-2026', 'Best Motion Picture – Non-English Language', 'Foreign Film', 4)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, subtitle, poster_url, display_order) VALUES
('cat-gg26-foreign', 'It Was Just an Accident', NULL, 'France', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27488_ItWasJustanAccident_PosterArt.png?w=500', 1),
('cat-gg26-foreign', 'No Other Choice', NULL, 'South Korea', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_29014_106_NoOtherChoice_LeeByunHun_Mansu_Character.jpg?w=500', 2),
('cat-gg26-foreign', 'Sentimental Value', NULL, 'Norway', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26566_SentimentalValue_PosterArt.jpg?w=500', 3),
('cat-gg26-foreign', 'Sirāt', NULL, 'Spain', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27491_Sirat_PosterArt.jpg?w=500', 4),
('cat-gg26-foreign', 'The Secret Agent', NULL, 'Brazil', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27489_SecretAgentThe_PosterArt.jpg?w=500', 5),
('cat-gg26-foreign', 'The Voice of Hind Rajab', NULL, 'Tunisia', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28697_109_VoiceofHindRajabThe_ClaraKhoury_NisreenJeriesQawas_Character.jpeg?w=500', 6);

-- 5. Best Female Actor in a Motion Picture – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actress-drama', 'gg-2026', 'Best Performance by a Female Actor in a Motion Picture – Drama', 'Actress (Drama)', 5)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-actress-drama', 'Eva Victor', 'Sorry, Baby', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28299_102_SorryBaby_EvaVictor_Agnes_Headshot.jpg?w=500', 1),
('cat-gg26-actress-drama', 'Jennifer Lawrence', 'Die My Love', 'https://goldenglobes.com/wp-content/uploads/2023/10/Jennifer-Lawrence-Photo.png?w=600', 2),
('cat-gg26-actress-drama', 'Jessie Buckley', 'Hamnet', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28113_102_Hamnet_JessieBuckley_Agnes_Headshot.png?w=500', 3),
('cat-gg26-actress-drama', 'Julia Roberts', 'After the Hunt', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_27687_102_AfterTheHunt_JuliaRoberts_Alma_Headshot.jpg?w=500', 4),
('cat-gg26-actress-drama', 'Renate Reinsve', 'Sentimental Value', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26566_102_SentimentalValue_RenateReinsve_NoraBorg_Headshot.jpg?w=500', 5),
('cat-gg26-actress-drama', 'Tessa Thompson', 'Hedda (2025)', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_Hedda_TessaThompson_Headshot.jpg?w=600', 6);

-- 6. Best Male Actor in a Motion Picture – Drama
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actor-drama', 'gg-2026', 'Best Performance by a Male Actor in a Motion Picture – Drama', 'Actor (Drama)', 6)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-actor-drama', 'Dwayne Johnson', 'The Smashing Machine', 'https://goldenglobes.com/wp-content/uploads/2025/12/Dwayne-Johnson-Headshot-1.jpg?w=600', 1),
('cat-gg26-actor-drama', 'Jeremy Allen White', 'Springsteen: Deliver Me from Nowhere', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_25372_103_SpringsteenDeliverMefromNowhere_JeremyAllenWhite_BruceSpringsteen_Headshot.jpg?w=500', 2),
('cat-gg26-actor-drama', 'Joel Edgerton', 'Train Dreams', 'https://goldenglobes.com/wp-content/uploads/2023/10/MotionPicture_22745_103_TrainDreams_JoelEdgerton_RobertGrainier_Headshot.jpg?w=500', 3),
('cat-gg26-actor-drama', 'Michael B. Jordan', 'Sinners', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_24147_103_Sinners_MichaelBJordan_SmokeStack_Headshot.jpg?w=500', 4),
('cat-gg26-actor-drama', 'Oscar Isaac', 'Frankenstein', 'https://goldenglobes.com/wp-content/uploads/2023/10/MotionPicture_22740_103_Frankenstein_OscarIsaac_VictorFrankenstein_Headshot.jpg?w=500', 5),
('cat-gg26-actor-drama', 'Wagner Moura', 'The Secret Agent', 'https://goldenglobes.com/wp-content/uploads/2025/12/Television_24048_260_DopeThief_WagnerMoura_MannyCarvalho_Headshot.jpeg?w=500', 6);

-- 7. Best Female Actor in a Motion Picture – Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actress-comedy', 'gg-2026', 'Best Performance by a Female Actor in a Motion Picture – Musical or Comedy', 'Actress (Comedy)', 7)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-actress-comedy', 'Amanda Seyfried', 'The Testament of Ann Lee', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_29044_105_TestamentofAnnLeeThe_AmandaSeyfried_AnnLee_Headshot.jpg?w=500', 1),
('cat-gg26-actress-comedy', 'Chase Infiniti', 'One Battle After Another', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26672_105_OneBattleAfterAnother_ChaseInfiniti_Willa_Headshot.jpg?w=500', 2),
('cat-gg26-actress-comedy', 'Cynthia Erivo', 'Wicked: For Good', 'https://goldenglobes.com/wp-content/uploads/2024/12/Best_Performance_by_a_Female_Actor_in_a_Motion_Picture_-_Musical_or_Comedy_Wicked_Cynthia_Erivo_Out_of_Character_Headshot.jpg?w=600', 3),
('cat-gg26-actress-comedy', 'Emma Stone', 'Bugonia', 'https://goldenglobes.com/wp-content/uploads/2023/10/Emma-Stone-Photo-2.png?w=500', 4),
('cat-gg26-actress-comedy', 'Kate Hudson', 'Song Sung Blue', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_28114_105_SongSungBlue_KateHudson_ClaireSardina_Headshot.jpg?w=500', 5),
('cat-gg26-actress-comedy', 'Rose Byrne', 'If I Had Legs I''d Kick You', 'https://goldenglobes.com/wp-content/uploads/2025/12/Television_24045_200_Platonic_RoseByrne_Sylvia_Headshot.jpg?w=500', 6);

-- 8. Best Male Actor in a Motion Picture – Musical or Comedy
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-actor-comedy', 'gg-2026', 'Best Performance by a Male Actor in a Motion Picture – Musical or Comedy', 'Actor (Comedy)', 8)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-actor-comedy', 'Ethan Hawke', 'Blue Moon', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22433_106_BlueMoon_EthanHawke_LorenzHart_Headshot.jpeg?w=500', 1),
('cat-gg26-actor-comedy', 'George Clooney', 'Jay Kelly', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_22736_106_JayKelly_GeorgeClooney_JayKelly_Headshot.jpg?w=500', 2),
('cat-gg26-actor-comedy', 'Jesse Plemons', 'Bugonia', 'https://goldenglobes.com/wp-content/uploads/2024/12/Best_Performance_by_a_Male_Actor_in_a_Motion_Picture_-_Musical_or_Comedy_Kinds_of_Kindness_Jesse_Plemons_Character_Headshot.png?w=600', 3),
('cat-gg26-actor-comedy', 'Lee Byung-Hun', 'No Other Choice', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_29014_106_NoOtherChoice_LeeByunHun_Mansu_Headshot.jpg?w=500', 4),
('cat-gg26-actor-comedy', 'Leonardo DiCaprio', 'One Battle After Another', 'https://goldenglobes.com/wp-content/uploads/2023/10/leo-2023.jpg?w=600', 5),
('cat-gg26-actor-comedy', 'Timothée Chalamet', 'Marty Supreme', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_24672_106_MartySupreme_TimotheeChalamet_MartyMauser_Headshot.jpg?w=500', 6);

-- 9. Best Female Actor in a Supporting Role
INSERT INTO awards_categories (id, event_id, name, short_name, display_order)
VALUES ('cat-gg26-supporting-actress', 'gg-2026', 'Best Performance by a Female Actor in a Supporting Role in any Motion Picture', 'Supporting Actress', 9)
ON CONFLICT DO NOTHING;

INSERT INTO awards_nominees (category_id, name, title, poster_url, display_order) VALUES
('cat-gg26-supporting-actress', 'Amy Madigan', 'Weapons', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26670_109_Weapons_AmyMadigan_Gladys_Headshot.png?w=440', 1),
('cat-gg26-supporting-actress', 'Ariana Grande', 'Wicked: For Good', 'https://goldenglobes.com/wp-content/uploads/2024/12/Best_Performance_by_a_Female_Actor_in_a_Supporting_Role_in_any_Motion_Picture_Wicked_Ariana_Grande_Out_of_Character_Headshot.jpeg?w=600', 2),
('cat-gg26-supporting-actress', 'Elle Fanning', 'Sentimental Value', 'https://goldenglobes.com/wp-content/uploads/2023/12/ELLE-FANNING-Photo.jpg?w=600', 3),
('cat-gg26-supporting-actress', 'Emily Blunt', 'The Smashing Machine', 'https://goldenglobes.com/wp-content/uploads/2023/10/EMILY-BLUNT-Photo.jpg?w=600', 4),
('cat-gg26-supporting-actress', 'Inga Ibsdotter Lilleaas', 'Sentimental Value', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26566_109_SentimentalValue_IngaIbsdotterLilleaas_AgnesBorgPetterson_Headshot.jpg?w=480', 5),
('cat-gg26-supporting-actress', 'Teyana Taylor', 'One Battle After Another', 'https://goldenglobes.com/wp-content/uploads/2025/12/MotionPicture_26672_109_OneBattleAfterAnother_TeyanaTaylor_Perfidia_Headshot.jpg?w=500', 6);
