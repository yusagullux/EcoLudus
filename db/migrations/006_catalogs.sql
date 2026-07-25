-- 006_catalogs.sql
-- DB-backed shop + team-mission catalogs. The catalog is the source of truth
-- for prices and team-mission rewards: /api/shop/buy and /api/teams `assign`
-- look items up by id and ignore any client-supplied price/xp/eco, so a
-- client can never buy cheaper or start a team mission with inflated rewards.
--
-- Seeds mirror SHOP_CATALOG / TEAM_MISSION_TEMPLATES in lib/catalog.ts and the
-- file-fallback seeds in EMPTY_STORE (lib/db.ts). Keep all three in sync when
-- editing. The upsert below re-applies the seed values on every migration run,
-- so updating this file and re-running `npm run db:migrate` updates the live
-- catalog with no code deploy.
--
-- These tables are also created by ensureMigrations() (the runtime source of
-- truth in lib/db.ts); this file lets a manual `npm run db:migrate` against an
-- existing DB pick them up.

create table if not exists catalog_items (
  mode text not null check (mode in ('plants', 'eggs', 'chests')),
  item_id integer not null,
  name text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  price integer not null check (price >= 0),
  image text not null,
  hatch_time text,
  description text,
  sort_order integer not null default 0,
  primary key (mode, item_id)
);

create table if not exists team_mission_templates (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  xp integer not null check (xp >= 0),
  eco integer not null check (eco >= 0),
  needed integer not null check (needed >= 1),
  sort_order integer not null default 0
);

insert into catalog_items (mode, item_id, name, rarity, price, image, hatch_time, description, sort_order)
values
  ('plants', 1, 'Mossy Fern', 'common', 50, '/images/plants/mint.png', null, null, 0),
  ('plants', 2, 'Golden Daisy', 'common', 60, '/images/plants/sunflower.png', null, null, 1),
  ('plants', 3, 'Blue Orchid', 'rare', 180, '/images/plants/orchid.png', null, null, 2),
  ('plants', 4, 'Spotted Aloe', 'rare', 200, '/images/plants/basil.png', null, null, 3),
  ('plants', 5, 'Mystic Bamboo', 'epic', 450, '/images/plants/bamboo.png', null, null, 4),
  ('plants', 6, 'Crystal Lotus', 'epic', 500, '/images/plants/lotus.png', null, null, 5),
  ('plants', 7, 'Aurora Blossom', 'legendary', 1200, '/images/plants/cherry_blossom.png', null, null, 6),
  ('plants', 8, 'Ember Cactus', 'legendary', 1500, '/images/plants/dragonfruit.png', null, null, 7),
  ('eggs', 1, 'Common Egg', 'common', 100, '/images/eggs/common-egg.png', '1h', null, 0),
  ('eggs', 2, 'Rare Egg', 'rare', 300, '/images/eggs/rare-egg.png', '4h', null, 1),
  ('eggs', 3, 'Epic Egg', 'epic', 700, '/images/eggs/epic-egg.png', '12h', null, 2),
  ('eggs', 4, 'Legendary Egg', 'legendary', 1800, '/images/eggs/legendary-egg.png', '24h', null, 3),
  ('chests', 1, 'Wooden Chest', 'common', 150, '/images/chests/wooden-chest.png', null, 'Contains EcoCoins or Common Plants!', 0),
  ('chests', 2, 'Bronze Chest', 'rare', 350, '/images/chests/bronze-chest.png', null, 'Contains EcoCoins, Rare Plants, or Common Eggs!', 1),
  ('chests', 3, 'Silver Chest', 'epic', 800, '/images/chests/silver-chest.png', null, 'Contains a large amount of EcoCoins, Epic Plants, or Eggs!', 2),
  ('chests', 4, 'Golden Chest', 'legendary', 2000, '/images/chests/golden-chest.png', null, 'Contains massive EcoCoins, Legendary Plants, or Eggs!', 3)
on conflict (mode, item_id) do update
set name = excluded.name,
    rarity = excluded.rarity,
    price = excluded.price,
    image = excluded.image,
    hatch_time = excluded.hatch_time,
    description = excluded.description,
    sort_order = excluded.sort_order;

insert into team_mission_templates (id, title, description, icon, difficulty, xp, eco, needed, sort_order)
values
  ('t1', 'Recycle 15 Plastic Bottles', 'Split the work and recycle at least 15 plastic bottles as a team.', '♻️', 'Easy', 240, 140, 3, 0),
  ('t2', 'Clean One Shared Area', 'Pick a park block or stairwell and leave it visibly better.', '🧹', 'Easy', 260, 160, 3, 1),
  ('t3', 'Commute Sustainably', 'At least 3 teammates bike, walk or take transit instead of a car.', '🚶', 'Medium', 300, 180, 3, 2),
  ('t4', 'Save 50 Liters of Water', 'Collectively save about 50 liters through shorter showers.', '💧', 'Medium', 320, 190, 3, 3),
  ('t5', 'Night Power Down', 'Unplug unused chargers/devices across at least 3 households.', '🔌', 'Easy', 220, 130, 2, 4),
  ('t6', 'Plant or Care for 3 Greens', 'Plant seeds or tend to three different plants as a joint effort.', '🌱', 'Easy', 210, 120, 3, 5),
  ('t7', 'Zero-Waste Group Feast', 'Organize a group meal where all food ingredients are package-free and zero waste is generated.', '🍽️', 'Hard', 500, 300, 4, 6),
  ('t8', 'Plastic Cleanup Blitz', 'Do a neighborhood walk together and clean up 50 items of plastic waste.', '🚯', 'Medium', 380, 220, 3, 7),
  ('t9', 'Community Energy Audit', 'Inspect and log energy usage parameters in your homes to identify major power-draining sources.', '📊', 'Hard', 550, 340, 4, 8),
  ('t10', 'Shared Compost Starter', 'Set up or refresh a shared compost bin and have teammates add approved food scraps.', 'CP', 'Medium', 420, 250, 3, 9),
  ('t11', 'Reusable Kit Relay', 'Each teammate prepares a reusable bottle, bag, and container kit for the week.', 'RK', 'Easy', 280, 170, 3, 10),
  ('t12', 'Tree Care Patrol', 'Water, mulch, or clean around nearby trees and document care from multiple teammates.', 'TC', 'Medium', 460, 280, 4, 11),
  ('t13', 'Repair Circle', 'Work together to repair clothes, gear, or household items instead of replacing them.', 'RC', 'Hard', 600, 380, 4, 12)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    difficulty = excluded.difficulty,
    xp = excluded.xp,
    eco = excluded.eco,
    needed = excluded.needed,
    sort_order = excluded.sort_order;