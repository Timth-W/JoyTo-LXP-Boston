DROP DATABASE IF EXISTS joyto;
CREATE DATABASE joyto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE joyto;

CREATE TABLE app_state (
  id VARCHAR(64) PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  role ENUM('senior', 'companion', 'family') NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash CHAR(64) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  bio_en TEXT NOT NULL,
  bio_fr TEXT NOT NULL,
  sector ENUM('gardens', 'centre', 'station', 'university') NOT NULL,
  interests JSON NOT NULL DEFAULT ('[]'),
  availability JSON NOT NULL DEFAULT ('[]'),
  invite_code VARCHAR(32) DEFAULT NULL UNIQUE,
  locale ENUM('en', 'fr') NOT NULL DEFAULT 'en',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  demo TINYINT(1) NOT NULL DEFAULT 0,
  CHECK (invite_code IS NULL OR role = 'senior')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE companion_profiles (
  user_id VARCHAR(64) PRIMARY KEY,
  sectors JSON NOT NULL DEFAULT ('[]'),
  verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  CONSTRAINT fk_companion_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE family_links (
  id VARCHAR(64) PRIMARY KEY,
  senior_id VARCHAR(64) NOT NULL,
  family_id VARCHAR(64) NOT NULL,
  relation ENUM('son', 'daughter', 'grandchild', 'partner', 'friend', 'neighbour', 'other') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_family_link (senior_id, family_id),
  CONSTRAINT fk_family_links_senior FOREIGN KEY (senior_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_family_links_family FOREIGN KEY (family_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activities (
  id VARCHAR(64) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_fr VARCHAR(255) NOT NULL,
  description_en TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  category ENUM('gardening', 'cooking', 'games', 'culture', 'walk', 'music', 'coffee') NOT NULL,
  starts_at DATETIME NOT NULL,
  place_en VARCHAR(255) NOT NULL,
  place_fr VARCHAR(255) NOT NULL,
  sector ENUM('gardens', 'centre', 'station', 'university') NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  organizer_en VARCHAR(255) NOT NULL,
  organizer_fr VARCHAR(255) NOT NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  map_x DECIMAL(5,2) NULL,
  map_y DECIMAL(5,2) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE registrations (
  id VARCHAR(64) PRIMARY KEY,
  activity_id VARCHAR(64) NOT NULL,
  senior_id VARCHAR(64) NOT NULL,
  via ENUM('assistant', 'manual', 'catalogue') NOT NULL DEFAULT 'catalogue',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registration (activity_id, senior_id),
  CONSTRAINT fk_registrations_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_registrations_senior FOREIGN KEY (senior_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE missions (
  id VARCHAR(64) PRIMARY KEY,
  senior_id VARCHAR(64) NOT NULL,
  booked_by_id VARCHAR(64) NOT NULL,
  payer_id VARCHAR(64) NOT NULL,
  activity_id VARCHAR(64) NULL,
  type ENUM('activity', 'walk', 'errands', 'company') NOT NULL,
  note TEXT NOT NULL,
  starts_at DATETIME NOT NULL,
  duration_min INT NOT NULL CHECK (duration_min BETWEEN 60 AND 240),
  sector ENUM('gardens', 'centre', 'station', 'university') NOT NULL,
  meeting_point VARCHAR(255) NOT NULL,
  status ENUM('open', 'confirmed', 'done', 'cancelled') NOT NULL DEFAULT 'open',
  via ENUM('assistant', 'manual', 'catalogue') NOT NULL DEFAULT 'manual',
  cancel_reason TEXT NULL,
  rating INT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_missions_senior FOREIGN KEY (senior_id) REFERENCES users(id),
  CONSTRAINT fk_missions_booked_by FOREIGN KEY (booked_by_id) REFERENCES users(id),
  CONSTRAINT fk_missions_payer FOREIGN KEY (payer_id) REFERENCES users(id),
  CONSTRAINT fk_missions_activity FOREIGN KEY (activity_id) REFERENCES activities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE offers (
  id VARCHAR(64) PRIMARY KEY,
  mission_id VARCHAR(64) NOT NULL,
  companion_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'accepted', 'declined', 'withdrawn') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_flag TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'accepted' THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY uq_offer_per_companion (mission_id, companion_id),
  UNIQUE KEY uq_one_accepted_offer (mission_id, accepted_flag),
  CONSTRAINT fk_offers_mission FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  CONSTRAINT fk_offers_companion FOREIGN KEY (companion_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id VARCHAR(64) PRIMARY KEY,
  mission_id VARCHAR(64) NOT NULL UNIQUE,
  payer_id VARCHAR(64) NOT NULL,
  amount_cents INT NOT NULL,
  gift_minutes INT NOT NULL DEFAULT 0,
  card_cents INT NOT NULL,
  status ENUM('authorized', 'captured', 'refunded') NOT NULL DEFAULT 'authorized',
  provider_reference VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_mission FOREIGN KEY (mission_id) REFERENCES missions(id),
  CONSTRAINT fk_payments_payer FOREIGN KEY (payer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gift_cards (
  id VARCHAR(64) PRIMARY KEY,
  buyer_id VARCHAR(64) NOT NULL,
  senior_id VARCHAR(64) NOT NULL,
  minutes_total INT NOT NULL,
  minutes_left INT NOT NULL CHECK (minutes_left >= 0),
  price_cents INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gift_cards_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_gift_cards_senior FOREIGN KEY (senior_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  params JSON NOT NULL,
  href VARCHAR(255) NOT NULL,
  read_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user_created (user_id, created_at DESC),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  senior_id VARCHAR(64) NOT NULL,
  sender ENUM('user', 'ai') NOT NULL,
  text TEXT NOT NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_messages_senior FOREIGN KEY (senior_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo seed data mirroring createSeed() in src/lib/seed.ts
INSERT INTO users (
  id, role, email, password_hash, first_name, last_name, bio_en, bio_fr,
  sector, interests, availability, invite_code, locale, created_at, demo
) VALUES
  ('u-marie', 'senior', 'marie@demo.joyto.app', '77f36ab7c4ac17f440b87897086522e66863b5ca0546c3f68df4eb6085677f7d', 'Marie', 'Lefèvre',
   'Retired primary school teacher. I love my little flowery balcony.',
   'Ancienne institutrice, j\'adore mon petit balcon fleuri.',
   'gardens', JSON_ARRAY('gardening', 'cooking', 'walk'), JSON_ARRAY('wed-pm', 'sat-am', 'sat-pm', 'sun-am'), 'JOY-4821', 'en', '2026-10-01 09:00:00', 1),
  ('u-jeanne', 'senior', 'jeanne@demo.joyto.app', '23b99ce04ee9bf28b9ed8335341c884211148a50de7f74fd12fd91f6fb9cfc20', 'Jeanne', 'Morel',
   'Avid reader, always up for a coffee.',
   'Lectrice assidue, toujours partante pour un café.',
   'gardens', JSON_ARRAY('gardening', 'cooking', 'coffee'), JSON_ARRAY('tue-am', 'sat-pm'), 'JOY-3307', 'en', '2026-10-01 09:00:00', 1),
  ('u-andre', 'senior', 'andre@demo.joyto.app', '7e0ebff6f514d1a1ed0249b7e853baec28af65d12e71ff28ed741242082eecd9', 'André', 'Duval',
   'Former dock worker, I sing in the choir.',
   'Ancien docker, je chante dans la chorale.',
   'gardens', JSON_ARRAY('gardening', 'music', 'walk'), JSON_ARRAY('sat-pm', 'sun-am', 'mon-pm'), 'JOY-5512', 'en', '2026-10-01 09:00:00', 1),
  ('u-paul', 'senior', 'paul@demo.joyto.app', '27d9e35936c3244b6572a3113f16f5ba31160b040e4cb7b18ead14d930ad35d6', 'Paul', 'Benoît',
   'A formidable card player.',
   'Joueur de belote redoutable.',
   'centre', JSON_ARRAY('games', 'culture', 'walk'), JSON_ARRAY('fri-pm', 'sun-am'), 'JOY-6190', 'en', '2026-10-01 09:00:00', 1),
  ('u-karim', 'companion', 'karim@demo.joyto.app', '39fc91ce826e6deb353da05a9169a1b50a5cad00075d92c04f2da36b4a065ec3', 'Karim', 'Haddad',
   '22, sports science student. I grow tomatoes on my balcony.',
   '22 ans, étudiant en STAPS. Je cultive des tomates sur mon balcon.',
   'university', JSON_ARRAY('gardening', 'culture', 'games'), JSON_ARRAY('fri-pm', 'sat-am', 'sat-pm', 'sun-am'), NULL, 'en', '2026-10-01 09:00:00', 1),
  ('u-lea', 'companion', 'lea@demo.joyto.app', 'fbf66703ad79bb02f2fc8f3f32e3528c9b742911cb997587325d5ebcdcf9c19a', 'Léa', 'Martin',
   '24, nursing student. I cook for my whole flatshare.',
   '24 ans, étudiante infirmière. Je cuisine pour toute ma colocation.',
   'centre', JSON_ARRAY('cooking', 'music', 'coffee'), JSON_ARRAY('tue-am', 'wed-pm', 'thu-am', 'sun-am'), NULL, 'en', '2026-10-01 09:00:00', 1),
  ('u-tom', 'companion', 'tom@demo.joyto.app', '77192df82bf3ba27672ede06c14f7e41a8612ee6908726e37c410c0e471570f9', 'Tom', 'Girard',
   'History student and board game fan.',
   'Étudiant en histoire, fan de jeux de plateau.',
   'station', JSON_ARRAY('games', 'culture'), JSON_ARRAY('fri-pm', 'sat-pm'), NULL, 'en', '2026-10-01 09:00:00', 1),
  ('u-sophie', 'family', 'sophie@demo.joyto.app', 'fdc4a41311350b53bc838cd03262f5b1f2c6ffd6b42abaf58bd6d189408b4907', 'Sophie', 'Lefèvre',
   'Marie\'s daughter. I live 500 km away.',
   'Fille de Marie, j\'habite à 500 km.',
   'centre', JSON_ARRAY(), JSON_ARRAY(), NULL, 'en', '2026-10-01 09:00:00', 1);

INSERT INTO companion_profiles (user_id, sectors, verified, verified_at) VALUES
  ('u-karim', JSON_ARRAY('gardens', 'centre', 'university'), 1, '2026-10-01 09:00:00'),
  ('u-lea', JSON_ARRAY('centre', 'gardens', 'station'), 1, '2026-10-01 09:00:00'),
  ('u-tom', JSON_ARRAY('station', 'centre'), 0, NULL);

INSERT INTO family_links (id, senior_id, family_id, relation, created_at) VALUES
  ('l1', 'u-marie', 'u-sophie', 'daughter', '2026-10-01 09:00:00');

INSERT INTO activities (
  id, title_en, title_fr, description_en, description_fr, category, starts_at,
  place_en, place_fr, sector, capacity, organizer_en, organizer_fr,
  latitude, longitude, map_x, map_y
) VALUES
  ('a0', 'Monthly coffee morning', 'Café-rencontre du mois', 'Coffee, biscuits and neighbourhood news.', 'Un café, des biscuits et les nouvelles du quartier.', 'coffee', '2026-10-29 10:00:00', 'Gardens community centre', 'Maison de quartier des Jardins', 'gardens', 14, 'Gardens community centre', 'Maison de quartier des Jardins', 48.8566, 2.3522, 30.00, 62.00),
  ('a2', 'Board games afternoon', 'Après-midi jeux de société', 'Cards, Scrabble and ludo in a quiet room.', 'Belote, Scrabble et petits chevaux, dans une salle calme.', 'games', '2026-11-13 14:00:00', 'Market Café', 'Café du Marché', 'centre', 12, 'Players\' club', 'Club des Joueurs', 48.8570, 2.3499, 58.00, 40.00),
  ('a1', 'Community garden workshop', 'Atelier au jardin partagé', 'Planting spring bulbs. Tools provided, benches on site.', 'Plantation des bulbes de printemps. Outils fournis, bancs sur place.', 'gardening', '2026-11-14 14:30:00', 'Lime Tree community garden', 'Jardin partagé des Tilleuls', 'gardens', 8, 'Lime Tree association', 'Association Les Tilleuls', 48.8550, 2.3505, 22.00, 34.00),
  ('a3', 'Walk in the town park', 'Balade au parc municipal', 'One hour at a gentle pace, with breaks on the benches.', 'Une heure de marche à petit rythme, avec des pauses sur les bancs.', 'walk', '2026-11-15 10:00:00', 'Park gate, Town Hall square', 'Entrée du parc, place de la Mairie', 'centre', 15, 'Sunday walkers', 'Marcheurs du dimanche', 48.8535, 2.3471, 66.00, 22.00),
  ('a4', 'Autumn soup to share', 'Soupe d\'automne à partager', 'We peel, we cook, then we have lunch together.', 'On épluche, on cuisine, puis on déjeune ensemble.', 'cooking', '2026-11-17 10:00:00', 'Gardens community centre', 'Maison de quartier des Jardins', 'gardens', 10, 'Gardens community centre', 'Maison de quartier des Jardins', 48.8566, 2.3522, 32.00, 58.00),
  ('a5', 'Guided tour of the Fine Arts Museum', 'Visite guidée du musée des Beaux-Arts', 'Seaside landscapes, seated tour available.', 'Les paysages de bord de mer, visite assise possible.', 'culture', '2026-11-20 15:00:00', 'Fine Arts Museum', 'Musée des Beaux-Arts', 'centre', 12, 'Fine Arts Museum', 'Musée des Beaux-Arts', 48.8590, 2.3444, 74.00, 48.00),
  ('a6', 'Neighbours\' choir', 'Chorale des voisins', 'Popular French songs, no experience needed.', 'Chansons françaises, aucune expérience nécessaire.', 'music', '2026-11-23 17:00:00', 'Village hall', 'Salle des fêtes', 'gardens', 20, 'Gardens choir', 'Chorale des Jardins', 48.8548, 2.3528, 14.00, 72.00),
  ('a7', 'Neighbourhood coffee morning', 'Café-rencontre du quartier', 'The monthly get-together for local residents.', 'Le rendez-vous mensuel des habitants.', 'coffee', '2026-11-26 10:00:00', 'Gardens community centre', 'Maison de quartier des Jardins', 'gardens', 14, 'Gardens community centre', 'Maison de quartier des Jardins', 48.8566, 2.3522, 28.00, 66.00),
  ('a8', 'Rose pruning', 'Taille des rosiers', 'Learn to prune before winter, with the town gardener.', 'Apprendre à tailler avant l\'hiver, avec le jardinier de la ville.', 'gardening', '2026-11-28 14:00:00', 'Lime Tree community garden', 'Jardin partagé des Tilleuls', 'gardens', 8, 'Lime Tree association', 'Association Les Tilleuls', 48.8550, 2.3505, 18.00, 30.00),
  ('a10', 'Tea and crosswords', 'Thé et mots croisés', 'A pot of tea, the weekly crossword and a good chat.', 'Une théière, la grille de la semaine et une bonne discussion.', 'coffee', '2026-11-13 17:00:00', 'Gardens library', 'Bibliothèque des Jardins', 'gardens', 10, 'Gardens library', 'Bibliothèque des Jardins', 48.8558, 2.3512, 40.00, 44.00),
  ('a9', 'Apple tart workshop', 'Atelier tarte aux pommes', 'Grandma\'s recipe, tasting on site.', 'Recette de grand-mère, dégustation sur place.', 'cooking', '2026-12-02 14:00:00', 'Gardens community centre', 'Maison de quartier des Jardins', 'gardens', 10, 'Gardens community centre', 'Maison de quartier des Jardins', 48.8566, 2.3522, 36.00, 54.00);

INSERT INTO registrations (id, activity_id, senior_id, via, created_at) VALUES
  ('r1', 'a0', 'u-marie', 'catalogue', '2026-10-02 09:00:00'),
  ('r2', 'a0', 'u-jeanne', 'catalogue', '2026-10-02 09:00:00'),
  ('r3', 'a1', 'u-jeanne', 'assistant', '2026-10-10 11:00:00'),
  ('r4', 'a1', 'u-andre', 'catalogue', '2026-10-10 11:00:00'),
  ('r5', 'a2', 'u-paul', 'catalogue', '2026-10-12 18:00:00'),
  ('r6', 'a3', 'u-andre', 'assistant', '2026-10-12 18:00:00'),
  ('r7', 'a3', 'u-paul', 'catalogue', '2026-10-12 18:00:00'),
  ('r8', 'a4', 'u-jeanne', 'catalogue', '2026-10-12 18:00:00'),
  ('r9', 'a6', 'u-andre', 'catalogue', '2026-10-14 13:00:00'),
  ('r10', 'a8', 'u-jeanne', 'assistant', '2026-10-14 13:00:00'),
  ('r11', 'a10', 'u-marie', 'catalogue', '2026-10-14 13:00:00'),
  ('r12', 'a10', 'u-jeanne', 'catalogue', '2026-10-14 13:00:00');

INSERT INTO missions (
  id, senior_id, booked_by_id, payer_id, activity_id, type, note, starts_at, duration_min,
  sector, meeting_point, status, via, created_at
) VALUES
  ('m1', 'u-paul', 'u-paul', 'u-paul', 'a3', 'walk', 'I walk slowly, I would like someone patient.', '2026-11-15 09:45:00', 90, 'centre', 'Pharmacy on Town Hall square', 'open', 'assistant', '2026-11-10 09:00:00'),
  ('m2', 'u-jeanne', 'u-jeanne', 'u-jeanne', 'a4', 'activity', 'Stairs are difficult for me.', '2026-11-17 09:45:00', 150, 'gardens', '12 Elm Street, buzzer "Morel"', 'confirmed', 'manual', '2026-11-08 11:00:00'),
  ('m3', 'u-marie', 'u-sophie', 'u-sophie', NULL, 'company', 'A coffee and a chat.', '2026-10-29 09:30:00', 120, 'gardens', 'Lime Tree residence, main entrance', 'done', 'manual', '2026-10-25 18:00:00');

INSERT INTO offers (id, mission_id, companion_id, status, created_at) VALUES
  ('o1', 'm2', 'u-lea', 'accepted', '2026-11-08 15:00:00'),
  ('o2', 'm3', 'u-lea', 'accepted', '2026-10-26 10:00:00');

INSERT INTO payments (id, mission_id, payer_id, amount_cents, gift_minutes, card_cents, status, created_at) VALUES
  ('p2', 'm2', 'u-jeanne', 6250, 0, 6250, 'authorized', '2026-11-08 11:00:00'),
  ('p3', 'm3', 'u-sophie', 5000, 0, 5000, 'captured', '2026-10-25 18:00:00');

INSERT INTO gift_cards (id, buyer_id, senior_id, minutes_total, minutes_left, price_cents, created_at) VALUES
  ('g1', 'u-sophie', 'u-marie', 300, 300, 11500, '2026-11-01 20:00:00');

INSERT INTO notifications (id, user_id, type, params, href, read_flag, created_at) VALUES
  ('n1', 'u-marie', 'giftReceived', JSON_OBJECT('actorId', 'u-sophie', 'minutes', 300), '/senior', 0, '2026-11-01 20:00:00'),
  ('n2', 'u-karim', 'newMission', JSON_OBJECT('seniorId', 'u-paul', 'missionId', 'm1', 'date', '2026-11-15T09:45'), '/companion/missions/m1', 0, '2026-11-10 09:00:00');

INSERT INTO chat_messages (id, senior_id, sender, text, payload, created_at) VALUES
  ('c1', 'u-marie', 'ai', 'Hello Marie! What would you like to do this week?', NULL, '2026-11-10 09:00:00');
