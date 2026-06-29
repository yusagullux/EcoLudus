import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createImageHash, getExistingPhotoHash, savePhotoHash, verifyImageWithProvider } from "@/lib/photo-verification";

// ── Seed stops (used when table is empty / file-store mode) ──────────────────
const SEED_STOPS = [
  // ── London, UK ────────────────────────────────────────────────────────────
  { id: "stop_hyde_park",           name: "Hyde Park Meadow",            type: "park",             lat: 51.5073, lng: -0.1657, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "A large green space in central London perfect for a nature walk." },
  { id: "stop_recycling_w2",        name: "Recycling Hub W2",            type: "recycling",        lat: 51.5120, lng: -0.1778, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Community recycling point accepting glass, plastic, and paper." },
  { id: "stop_garden_camden",       name: "Camden Community Garden",     type: "community_garden", lat: 51.5390, lng: -0.1426, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Volunteer-run urban garden with seasonal planting sessions." },
  { id: "stop_repair_brixton",      name: "Brixton Repair Café",         type: "repair_cafe",      lat: 51.4613, lng: -0.1156, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Fix clothes, electronics and furniture instead of replacing them." },
  { id: "stop_bike_kings",          name: "Kings Cross Bike Hub",        type: "bike_station",     lat: 51.5308, lng: -0.1238, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Bike parking and minor repair tools available for free." },
  { id: "stop_trail_richmond",      name: "Richmond Nature Trail",       type: "nature_trail",     lat: 51.4613, lng: -0.3037, xpReward: 50, ecoReward: 28, cooldownHours: 24, description: "3km marked trail through ancient woodland and riverside meadow." },
  { id: "stop_park_victoria",       name: "Victoria Park",               type: "park",             lat: 51.5362, lng: -0.0394, xpReward: 40, ecoReward: 22, cooldownHours: 24, description: "East London's largest park with nature zones and community events." },
  { id: "stop_recycling_ec1",       name: "Clerkenwell Eco Point",       type: "recycling",        lat: 51.5240, lng: -0.1058, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Multi-stream recycling including batteries and small electronics." },
  { id: "stop_garden_peck",         name: "Peckham Rooftop Garden",      type: "community_garden", lat: 51.4736, lng: -0.0693, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Rooftop growing space with workshops on urban food growing." },
  { id: "stop_trail_epping",        name: "Epping Forest Entry",         type: "nature_trail",     lat: 51.6520, lng:  0.0431, xpReward: 65, ecoReward: 40, cooldownHours: 48, description: "Ancient royal forest — one of the largest public open spaces near London." },
  { id: "stop_bike_southbank",      name: "Southbank Cycle Path",        type: "bike_station",     lat: 51.5055, lng: -0.1132, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Dedicated cycle lane running along the Thames with docking stations." },
  { id: "stop_repair_hackney",      name: "Hackney Repair Workshop",     type: "repair_cafe",      lat: 51.5450, lng: -0.0553, xpReward: 58, ecoReward: 33, cooldownHours: 48, description: "Community space for fixing electronics, bikes, and clothing." },

  // ── Paris, France ─────────────────────────────────────────────────────────
  { id: "stop_park_luxembourg",     name: "Jardin du Luxembourg",        type: "park",             lat: 48.8462, lng:  2.3372, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Historic Parisian garden with lawns, fountains, and beehives." },
  { id: "stop_recycling_paris_11",  name: "Éco-point Bastille",          type: "recycling",        lat: 48.8533, lng:  2.3692, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Glass, metal and cardboard recycling point near Place de la Bastille." },
  { id: "stop_bike_velib",          name: "Vélib' Station République",   type: "bike_station",     lat: 48.8674, lng:  2.3633, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Paris city bike-share station — pick up or drop off a Vélib' here." },
  { id: "stop_garden_paris_perm",   name: "Jardin Partagé Belleville",   type: "community_garden", lat: 48.8715, lng:  2.3797, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Shared community garden in Belleville with open planting days." },
  { id: "stop_trail_vincennes",     name: "Bois de Vincennes Trail",     type: "nature_trail",     lat: 48.8329, lng:  2.4434, xpReward: 55, ecoReward: 32, cooldownHours: 24, description: "Marked nature trails through Paris's largest public woodland." },

  // ── Berlin, Germany ───────────────────────────────────────────────────────
  { id: "stop_park_tiergarten",     name: "Tiergarten Forest Walk",      type: "park",             lat: 52.5145, lng: 13.3500, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Berlin's urban forest park — 210 hectares of trees and meadows." },
  { id: "stop_recycling_berlin_m",  name: "Recyclinghof Mitte",          type: "recycling",        lat: 52.5235, lng: 13.4025, xpReward: 40, ecoReward: 22, cooldownHours: 12, description: "Full-service recycling centre accepting all material types." },
  { id: "stop_repair_berlin",       name: "Berlin Repair Café Kreuzberg", type: "repair_cafe",     lat: 52.4987, lng: 13.4037, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Weekly repair event — bring broken items and skilled volunteers help fix them." },
  { id: "stop_bike_berlin_mitte",   name: "Nextbike Hub Alexanderplatz", type: "bike_station",     lat: 52.5219, lng: 13.4132, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Shared bike station in central Berlin near Alexanderplatz." },
  { id: "stop_garden_berlin_temp",  name: "Tempelhof Community Garden",  type: "community_garden", lat: 52.4735, lng: 13.4010, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Urban garden plots on the former Tempelhof airfield." },

  // ── Amsterdam, Netherlands ────────────────────────────────────────────────
  { id: "stop_park_vondelpark",     name: "Vondelpark Green Loop",       type: "park",             lat: 52.3579, lng:  4.8686, xpReward: 42, ecoReward: 24, cooldownHours: 24, description: "Amsterdam's most-visited park — great for cycling and birdwatching." },
  { id: "stop_recycling_amsterdam", name: "Milieustraat West",           type: "recycling",        lat: 52.3780, lng:  4.8413, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "City recycling depot accepting electronics, textiles, and hazardous waste." },
  { id: "stop_bike_amsterdam_c",    name: "Fietspunt Centraal",          type: "bike_station",     lat: 52.3791, lng:  4.8993, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Massive guarded bike parking and repair shop at Amsterdam Centraal." },
  { id: "stop_trail_haarlem",       name: "Haarlem Dune Trail",          type: "nature_trail",     lat: 52.3874, lng:  4.5946, xpReward: 60, ecoReward: 36, cooldownHours: 24, description: "Coastal dune nature reserve west of Haarlem with marked walking routes." },

  // ── New York, USA ─────────────────────────────────────────────────────────
  { id: "stop_park_centralpark",    name: "Central Park Ramble",         type: "park",             lat: 40.7757, lng: -73.9714, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Woodland area in Central Park known for birdwatching and quiet trails." },
  { id: "stop_recycling_nyc_ues",   name: "GrowNYC Greenmarket Recycling", type: "recycling",     lat: 40.7614, lng: -73.9776, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Textile and electronics recycling drop-off at the Union Square Greenmarket." },
  { id: "stop_garden_nyc_bronx",    name: "Bronx Community Garden",      type: "community_garden", lat: 40.8448, lng: -73.8648, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Community-run garden in the South Bronx growing food for local families." },
  { id: "stop_bike_nyc_hudson",     name: "Citi Bike — Hudson River Park", type: "bike_station",  lat: 40.7282, lng: -74.0107, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Citi Bike docking station along the Hudson River Greenway path." },
  { id: "stop_trail_nyc_highland",  name: "Inwood Hill Park Trail",      type: "nature_trail",     lat: 40.8677, lng: -73.9211, xpReward: 55, ecoReward: 32, cooldownHours: 24, description: "Manhattan's last remaining old-growth forest with marked nature trails." },
  { id: "stop_repair_nyc_brooklyn", name: "Brooklyn Repair Café",        type: "repair_cafe",      lat: 40.6892, lng: -73.9442, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Monthly repair event in Prospect Heights — fix, don't toss." },

  // ── Los Angeles, USA ──────────────────────────────────────────────────────
  { id: "stop_park_griffith",       name: "Griffith Park Nature Walk",   type: "park",             lat: 34.1341, lng: -118.2955, xpReward: 48, ecoReward: 27, cooldownHours: 24, description: "One of the largest urban parks in the US with trails and native plants." },
  { id: "stop_recycling_la_mid",    name: "LA Eco Station Mid-City",     type: "recycling",        lat: 34.0195, lng: -118.3455, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Recycling facility accepting used motor oil, batteries, and e-waste." },
  { id: "stop_bike_la_venice",      name: "Metro Bike — Venice Beach",   type: "bike_station",     lat: 33.9850, lng: -118.4695, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Metro Bike Share station at the Venice Beach boardwalk." },
  { id: "stop_garden_la_dt",        name: "LA Community Garden Downtown", type: "community_garden", lat: 34.0488, lng: -118.2518, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Downtown LA urban farm growing produce for local food banks." },

  // ── Toronto, Canada ───────────────────────────────────────────────────────
  { id: "stop_park_toronto_high",   name: "High Park Nature Trails",     type: "park",             lat: 43.6468, lng: -79.4637, xpReward: 48, ecoReward: 27, cooldownHours: 24, description: "Toronto's largest park with old-growth forest and oak savanna." },
  { id: "stop_recycling_toronto",   name: "Toronto Eco Centre Etobicoke", type: "recycling",       lat: 43.6205, lng: -79.5632, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Drop off paints, chemicals, electronics, and large appliances." },
  { id: "stop_bike_toronto_bay",    name: "Bike Share — Bay & Bloor",    type: "bike_station",     lat: 43.6696, lng: -79.3899, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Toronto Bike Share docking station in the Annex neighbourhood." },
  { id: "stop_trail_toronto_rouge", name: "Rouge National Urban Park",   type: "nature_trail",     lat: 43.8105, lng: -79.1565, xpReward: 65, ecoReward: 38, cooldownHours: 24, description: "Canada's first national urban park — wetlands, forests and beach." },

  // ── Sydney, Australia ─────────────────────────────────────────────────────
  { id: "stop_park_sydney_royal",   name: "Royal Botanic Garden",        type: "park",             lat: -33.8642, lng: 151.2166, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "27 hectares of gardens overlooking Sydney Harbour." },
  { id: "stop_recycling_sydney",    name: "Marrickville Recycling Depot", type: "recycling",       lat: -33.9131, lng: 151.1546, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Inner-west recycling hub — e-waste, textiles, and general recyclables." },
  { id: "stop_bike_sydney_cbd",     name: "Transport NSW Bike Hub CBD",  type: "bike_station",     lat: -33.8688, lng: 151.2093, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Secure bike parking and repair station in Sydney's central business district." },
  { id: "stop_trail_sydney_heads",  name: "Sydney Harbour Headland Trail", type: "nature_trail",   lat: -33.8365, lng: 151.2854, xpReward: 60, ecoReward: 36, cooldownHours: 24, description: "Coastal bushwalk with dramatic harbour views and native wildlife." },
  { id: "stop_garden_sydney_newt",  name: "Newtown Community Garden",    type: "community_garden", lat: -33.8975, lng: 151.1786, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Organic food garden run by volunteers in the inner west." },
  { id: "stop_repair_sydney_leich", name: "Leichhardt Repair Café",      type: "repair_cafe",      lat: -33.8837, lng: 151.1554, xpReward: 58, ecoReward: 33, cooldownHours: 48, description: "Monthly fix-it event for clothes, electronics, and household items." },

  // ── Tokyo, Japan ──────────────────────────────────────────────────────────
  { id: "stop_park_yoyogi",         name: "Yoyogi Park Forest",          type: "park",             lat: 35.6715, lng: 139.6946, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Shinjuku's largest park — forested areas popular with joggers and birdwatchers." },
  { id: "stop_recycling_tokyo_sh",  name: "Shibuya Eco Station",         type: "recycling",        lat: 35.6580, lng: 139.7016, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Small-appliance and battery recycling point in Shibuya ward." },
  { id: "stop_bike_tokyo_marunouchi", name: "Docomo Bike Share Marunouchi", type: "bike_station",  lat: 35.6812, lng: 139.7671, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Tokyo's shared cycle-assist bike station near Tokyo Station." },
  { id: "stop_trail_tokyo_takao",   name: "Mount Takao Forest Trail",    type: "nature_trail",     lat: 35.6254, lng: 139.2431, xpReward: 70, ecoReward: 42, cooldownHours: 48, description: "Sacred mountain with well-maintained forest trails one hour from central Tokyo." },
  { id: "stop_garden_tokyo_nerima", name: "Nerima Urban Farm",           type: "community_garden", lat: 35.7356, lng: 139.6516, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Tokyo's most active farming ward — open plots and guided growing sessions." },

  // ── Singapore ─────────────────────────────────────────────────────────────
  { id: "stop_park_sg_botanics",    name: "Singapore Botanic Gardens",   type: "park",             lat:  1.3138, lng: 103.8159, xpReward: 48, ecoReward: 27, cooldownHours: 24, description: "UNESCO-listed tropical gardens with a national orchid collection." },
  { id: "stop_recycling_sg_bishan", name: "Bishan E-Waste Collection",   type: "recycling",        lat:  1.3520, lng: 103.8480, xpReward: 40, ecoReward: 23, cooldownHours: 12, description: "NEA-authorised e-waste collection point in Bishan-Toa Payoh." },
  { id: "stop_bike_sg_eastcoast",   name: "SG Bike — East Coast Park",   type: "bike_station",     lat:  1.3005, lng: 103.9127, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Shared bike docking station along East Coast Park connector." },
  { id: "stop_trail_sg_bukit_timah","name": "Bukit Timah Nature Reserve", type: "nature_trail",    lat:  1.3520, lng: 103.7767, xpReward: 65, ecoReward: 38, cooldownHours: 24, description: "Primary rainforest reserve — highest biodiversity per square km on Earth." },
  { id: "stop_garden_sg_allotment", name: "Queenstown Community Garden", type: "community_garden", lat:  1.2941, lng: 103.8060, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "HDB rooftop community allotment with guided growing programmes." },

  // ── São Paulo, Brazil ─────────────────────────────────────────────────────
  { id: "stop_park_sp_ibirapuera",  name: "Parque Ibirapuera",           type: "park",             lat: -23.5874, lng: -46.6576, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "São Paulo's iconic park with lagoons, forests, and cycle paths." },
  { id: "stop_recycling_sp_pinheiros","name": "Ecoponto Pinheiros",      type: "recycling",        lat: -23.5641, lng: -46.6826, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Municipal eco-point for building waste, furniture, and electronics." },
  { id: "stop_bike_sp_paulista",    name: "Bike Sampa — Av. Paulista",   type: "bike_station",     lat: -23.5613, lng: -46.6558, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "City bike-share station on São Paulo's main avenue." },
  { id: "stop_trail_sp_cantareira", name: "Parque Estadual da Cantareira", type: "nature_trail",   lat: -23.4088, lng: -46.6256, xpReward: 68, ecoReward: 40, cooldownHours: 48, description: "The world's largest urban forest — Atlantic Forest trails and waterfalls." },

  // ── Cape Town, South Africa ───────────────────────────────────────────────
  { id: "stop_park_ct_kirstenbosch","name": "Kirstenbosch Garden Walk",  type: "park",             lat: -33.9883, lng:  18.4324, xpReward: 50, ecoReward: 28, cooldownHours: 24, description: "World-famous botanical garden on the slopes of Table Mountain." },
  { id: "stop_recycling_ct_obs",    name: "Observatory Recycling Depot", type: "recycling",        lat: -33.9380, lng:  18.4720, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Community recycling drop-off in the Observatory neighbourhood." },
  { id: "stop_trail_ct_tablemtn",   name: "Table Mountain Pipe Track",   type: "nature_trail",     lat: -33.9626, lng:  18.3962, xpReward: 70, ecoReward: 42, cooldownHours: 24, description: "Scenic trail along the contour of Table Mountain with fynbos flora." },
  { id: "stop_garden_ct_langa",     name: "Langa Urban Garden",          type: "community_garden", lat: -33.9411, lng:  18.5241, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Community vegetable garden supporting food security in Langa township." },

  // ── Tallinn, Estonia ──────────────────────────────────────────────────────
  { id: "stop_park_tallinn_kadriorg",    name: "Kadriorg Park",                  type: "park",             lat: 59.4370, lng: 24.7914, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Baroque park built by Peter the Great, with forested paths and a swan pond." },
  { id: "stop_park_tallinn_stroomi",     name: "Stroomi Beach Park",             type: "park",             lat: 59.4498, lng: 24.6891, xpReward: 40, ecoReward: 22, cooldownHours: 24, description: "Sandy beachside park on Tallinn Bay, popular for walks and picnics." },
  { id: "stop_park_tallinn_nõmme",       name: "Nõmme–Mustamäe Nature Reserve",  type: "park",             lat: 59.3886, lng: 24.6657, xpReward: 50, ecoReward: 28, cooldownHours: 24, description: "Protected pine and birch forest reserve inside the city limits." },
  { id: "stop_park_tallinn_glehn",       name: "Glehni Park",                    type: "park",             lat: 59.3780, lng: 24.6963, xpReward: 42, ecoReward: 24, cooldownHours: 24, description: "Romantic Victorian-era park with a castle folly and ancient trees." },
  { id: "stop_park_tallinn_laululava",   name: "Song Festival Grounds Green",    type: "park",             lat: 59.4444, lng: 24.7978, xpReward: 38, ecoReward: 21, cooldownHours: 24, description: "Parkland around the iconic song festival amphitheatre overlooking the bay." },
  { id: "stop_trail_tallinn_lahemaa",    name: "Pääsküla Bog Trail",             type: "nature_trail",     lat: 59.3712, lng: 24.6541, xpReward: 62, ecoReward: 37, cooldownHours: 24, description: "Boardwalk trail through a raised bog on the southern edge of Tallinn." },
  { id: "stop_trail_tallinn_pirita",     name: "Pirita Coastal Trail",           type: "nature_trail",     lat: 59.4636, lng: 24.8332, xpReward: 55, ecoReward: 32, cooldownHours: 24, description: "Scenic 5km trail along the Pirita river mouth and Baltic coast." },
  { id: "stop_trail_tallinn_harku",      name: "Harku Forest Trail",             type: "nature_trail",     lat: 59.4102, lng: 24.6204, xpReward: 58, ecoReward: 34, cooldownHours: 24, description: "Mixed forest trails around Lake Harku with boardwalks and bird hides." },
  { id: "stop_trail_tallinn_merimetsa",  name: "Merimetsa Nature Path",          type: "nature_trail",     lat: 59.4302, lng: 24.7012, xpReward: 48, ecoReward: 27, cooldownHours: 24, description: "Urban nature path through coastal meadows and shrubland near Pelgulinn." },
  { id: "stop_trail_tallinn_rocca",      name: "Rocca al Mare Shoreline Trail",  type: "nature_trail",     lat: 59.4421, lng: 24.6532, xpReward: 52, ecoReward: 30, cooldownHours: 24, description: "Coastal walking trail past the Open Air Museum with views of the Baltic." },
  { id: "stop_recycling_tallinn_ulem",   name: "Ülemiste Jäätmejaam",            type: "recycling",        lat: 59.4205, lng: 24.7872, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Tallinn's main waste station — accepts e-waste, hazardous materials, and bulky items." },
  { id: "stop_recycling_tallinn_mustam", name: "Mustamäe Recycling Point",       type: "recycling",        lat: 59.4042, lng: 24.6972, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Container recycling point for glass, paper, plastic, and metal." },
  { id: "stop_recycling_tallinn_lasnam", name: "Lasnamäe Recycling Containers",  type: "recycling",        lat: 59.4362, lng: 24.8102, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Multi-stream recycling bins serving the Lasnamäe district." },
  { id: "stop_recycling_tallinn_pirita", name: "Pirita Eco Point",               type: "recycling",        lat: 59.4612, lng: 24.8248, xpReward: 36, ecoReward: 21, cooldownHours: 12, description: "Recycling containers for glass, paper, and packaging near Pirita harbour." },
  { id: "stop_recycling_tallinn_nomme",  name: "Nõmme Jäätmepunkt",              type: "recycling",        lat: 59.3821, lng: 24.6934, xpReward: 36, ecoReward: 21, cooldownHours: 12, description: "Nõmme district waste and recycling drop-off, open year round." },
  { id: "stop_garden_tallinn_uus",       name: "Uus-Maailm Community Garden",    type: "community_garden", lat: 59.4278, lng: 24.7321, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Raised-bed community vegetable garden in the Uus-Maailm neighbourhood." },
  { id: "stop_garden_tallinn_kassisaba", name: "Kassisaba Urban Garden",         type: "community_garden", lat: 59.4358, lng: 24.7298, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Neighbourhood allotment garden behind Kassisaba recreation centre." },
  { id: "stop_garden_tallinn_kopli",     name: "Kopli Community Plots",          type: "community_garden", lat: 59.4581, lng: 24.7071, xpReward: 50, ecoReward: 28, cooldownHours: 24, description: "Urban growing plots on the Kopli peninsula with sea views." },
  { id: "stop_garden_tallinn_pelgulinn", name: "Pelgulinn Garden Collective",    type: "community_garden", lat: 59.4389, lng: 24.7058, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Residents' collective garden growing food and native wildflowers." },
  { id: "stop_repair_tallinn_kalamaja",  name: "Kalamaja Repair Café",           type: "repair_cafe",      lat: 59.4431, lng: 24.7261, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Monthly repair event in Kalamaja — volunteers fix electronics, clothes, and bikes." },
  { id: "stop_repair_tallinn_telliskivi", name: "Telliskivi Fix-It Workshop",    type: "repair_cafe",      lat: 59.4402, lng: 24.7244, xpReward: 62, ecoReward: 36, cooldownHours: 48, description: "Creative hub repair workshop — bring broken items every last Saturday." },
  { id: "stop_bike_tallinn_vanalinn",    name: "Tallinn Bike Share — Old Town",  type: "bike_station",     lat: 59.4370, lng: 24.7454, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "City bike-share station at the edge of Tallinn's UNESCO Old Town." },
  { id: "stop_bike_tallinn_kadriorg",    name: "Bike Hub — Kadriorg",            type: "bike_station",     lat: 59.4342, lng: 24.7989, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Bike docking and repair station near Kadriorg Palace." },
  { id: "stop_bike_tallinn_ülemiste",    name: "Ülemiste Bike Station",          type: "bike_station",     lat: 59.4157, lng: 24.7952, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Bike-share hub next to Ülemiste City tech campus and shopping centre." },
  { id: "stop_bike_tallinn_balti",       name: "Balti Jaam Cycle Point",         type: "bike_station",     lat: 59.4413, lng: 24.7367, xpReward: 30, ecoReward: 18, cooldownHours: 8,  description: "Bike parking and share station at Tallinn's main railway station." },

  // ── Merivälja, Tallinn ────────────────────────────────────────────────────
  { id: "stop_trail_merivalja_coastal",  name: "Merivälja Coastal Walk",         type: "nature_trail",     lat: 59.4712, lng: 24.8561, xpReward: 58, ecoReward: 34, cooldownHours: 24, description: "Quiet shoreline trail along Merivälja beach through coastal pine forest." },
  { id: "stop_park_merivalja_pine",      name: "Merivälja Pine Grove",           type: "park",             lat: 59.4688, lng: 24.8512, xpReward: 42, ecoReward: 24, cooldownHours: 24, description: "Peaceful pine and birch forest park in the heart of the Merivälja neighbourhood." },
  { id: "stop_recycling_merivalja",      name: "Merivälja Recycling Containers", type: "recycling",        lat: 59.4671, lng: 24.8487, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Roadside multi-stream recycling bins for glass, paper, plastic, and metal." },
  { id: "stop_garden_merivalja",         name: "Merivälja Community Garden",     type: "community_garden", lat: 59.4658, lng: 24.8534, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Small residents' garden collective growing vegetables and berry bushes." },
  { id: "stop_bike_merivalja",           name: "Merivälja Bike Path Hub",        type: "bike_station",     lat: 59.4695, lng: 24.8548, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Bike parking and pump station at the start of the Merivälja coastal cycle route." },

  // ── Tartu, Estonia ────────────────────────────────────────────────────────
  { id: "stop_park_tartu_toomemagi",     name: "Toomemägi Hill Park",            type: "park",             lat: 58.3810, lng: 26.7227, xpReward: 45, ecoReward: 25, cooldownHours: 24, description: "Forested hilltop park in Tartu's historic centre with cathedral ruins and pond." },
  { id: "stop_park_tartu_annelinn",      name: "Annelinn Forest Park",           type: "park",             lat: 58.3648, lng: 26.7521, xpReward: 40, ecoReward: 22, cooldownHours: 24, description: "Green corridor through the Annelinn district with walking and cycling paths." },
  { id: "stop_trail_tartu_emajogi",      name: "Emajõgi Riverside Trail",        type: "nature_trail",     lat: 58.3780, lng: 26.7312, xpReward: 55, ecoReward: 32, cooldownHours: 24, description: "Flat 8km trail along the Emajõgi river banks — great for cycling and walking." },
  { id: "stop_trail_tartu_alatskivi",    name: "Tartu Nature Trail — Ropka",     type: "nature_trail",     lat: 58.3531, lng: 26.7178, xpReward: 58, ecoReward: 34, cooldownHours: 24, description: "Mixed forest trail in the Ropka–Ihaste nature area south of the city." },
  { id: "stop_recycling_tartu_central",  name: "Tartu Jäätmejaam",               type: "recycling",        lat: 58.3749, lng: 26.7402, xpReward: 38, ecoReward: 22, cooldownHours: 12, description: "Tartu's main waste station accepting e-waste, hazardous items, and bulky refuse." },
  { id: "stop_recycling_tartu_annelinn", name: "Annelinn Recycling Containers",  type: "recycling",        lat: 58.3652, lng: 26.7498, xpReward: 35, ecoReward: 20, cooldownHours: 12, description: "Multi-stream recycling bins for paper, glass, plastic, and metal." },
  { id: "stop_garden_tartu_karlova",     name: "Karlova Community Garden",       type: "community_garden", lat: 58.3733, lng: 26.7365, xpReward: 52, ecoReward: 29, cooldownHours: 24, description: "Neighbourhood garden in the wooden-house Karlova district with shared allotment beds." },
  { id: "stop_garden_tartu_supilinn",    name: "Supilinn Urban Garden",          type: "community_garden", lat: 58.3842, lng: 26.7278, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Community vegetable garden in Tartu's charming Supilinn soup town quarter." },
  { id: "stop_repair_tartu_tasku",       name: "Tartu Repair Café",              type: "repair_cafe",      lat: 58.3771, lng: 26.7289, xpReward: 60, ecoReward: 35, cooldownHours: 48, description: "Monthly fix-it event near Tasku centre — skilled volunteers repair your broken items." },
  { id: "stop_bike_tartu_kesklinn",      name: "Tartu Bike Share — City Centre",  type: "bike_station",    lat: 58.3780, lng: 26.7293, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Tartu city bike-share station in the town hall square area." },
  { id: "stop_bike_tartu_ülikool",       name: "University of Tartu Bike Hub",   type: "bike_station",     lat: 58.3797, lng: 26.7153, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Bike parking and repair station at the University of Tartu main building." },
  { id: "stop_park_mumbai_sanjay",  name: "Sanjay Gandhi National Park", type: "park",             lat: 19.2147, lng:  72.9100, xpReward: 55, ecoReward: 32, cooldownHours: 24, description: "Tropical dry deciduous forest inside Mumbai — leopards, butterflies, and birds." },
  { id: "stop_recycling_mumbai_bkc","name": "BKC E-Waste Collection",    type: "recycling",        lat: 19.0650, lng:  72.8650, xpReward: 40, ecoReward: 23, cooldownHours: 12, description: "Authorised e-waste recycling collection point in Bandra-Kurla Complex." },
  { id: "stop_garden_mumbai_dharavi","name":"Dharavi Urban Farm",         type: "community_garden", lat: 19.0413, lng:  72.8545, xpReward: 55, ecoReward: 30, cooldownHours: 24, description: "Grassroots urban farming initiative growing vegetables in Dharavi." },
  { id: "stop_bike_mumbai_bandra",  name: "Yulu Bike — Bandra Station",  type: "bike_station",     lat: 19.0544, lng:  72.8407, xpReward: 28, ecoReward: 16, cooldownHours: 8,  description: "Yulu electric bike-share station near Bandra railway station." },
];

type Stop = typeof SEED_STOPS[number];
const CHECKIN_RADIUS_M = 100;

// Haversine distance in metres
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parsePhotoProof(photoProof: unknown, mimeType: unknown): { buffer: Buffer; mimeType: string } | null {
  if (typeof photoProof !== "string" || photoProof.length < 100) return null;

  const dataUrlMatch = photoProof.match(/^data:([^;]+);base64,(.+)$/);
  const resolvedMimeType = dataUrlMatch?.[1] || (typeof mimeType === "string" ? mimeType : "image/jpeg");
  const base64 = dataUrlMatch?.[2] || photoProof;

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length < 1024) return null;
    return { buffer, mimeType: resolvedMimeType };
  } catch {
    return null;
  }
}

// ── GET /api/ecostops?lat=X&lng=Y&radius=N ────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat") ?? "NaN");
  const lng    = parseFloat(searchParams.get("lng") ?? "NaN");
  const radius = parseFloat(searchParams.get("radius") ?? "25000"); // metres, default 25km

  // Always return the seed stops (in production you'd query a DB table).
  // Filter by radius when a location is provided.
  const stops: Stop[] = isNaN(lat) || isNaN(lng)
    ? SEED_STOPS
    : SEED_STOPS.filter(s => distM(lat, lng, s.lat, s.lng) <= radius);

  return NextResponse.json({ stops, total: stops.length });
}

// ── POST /api/ecostops (check-in) ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { code: "auth/unauthenticated", message: "Not signed in." } }, { status: 401 });
    }
    const userId = session.userId;

    const body = await req.json().catch(() => null);
    if (!body?.stopId) {
      return NextResponse.json({ success: false, error: { code: "ecostop/missing-stop-id", message: "stopId is required." } }, { status: 400 });
    }

    const stop = SEED_STOPS.find(s => s.id === body.stopId);
    if (!stop) {
      return NextResponse.json({ success: false, error: { code: "ecostop/not-found", message: "EcoStop not found." } }, { status: 404 });
    }

    const userLat = Number(body.lat);
    const userLng = Number(body.lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return NextResponse.json({ success: false, error: { code: "ecostop/location-required", message: "Location is required for EcoStop check-in." } }, { status: 422 });
    }

    const distanceM = distM(userLat, userLng, stop.lat, stop.lng);
    if (distanceM > CHECKIN_RADIUS_M) {
      return NextResponse.json({
        success: false,
        error: {
          code: "ecostop/out-of-range",
          message: `Move within ${CHECKIN_RADIUS_M}m of this EcoStop before checking in.`,
          distanceM: Math.round(distanceM)
        }
      }, { status: 403 });
    }

    const photo = parsePhotoProof(body.photoProof, body.mimeType);
    if (!photo) {
      return NextResponse.json({ success: false, error: { code: "ecostop/photo-required", message: "Photo proof is required for EcoStop check-in." } }, { status: 422 });
    }

    // Load user to check cooldown and apply rewards
    const userResult = await sql<{ id: string; email: string; payload: Record<string, unknown> }>(
      "SELECT id, email, payload FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (!userResult.rows[0]) {
      return NextResponse.json({ success: false, error: { code: "auth/user-not-found" } }, { status: 404 });
    }
    const user = userResult.rows[0];
    const payload = user.payload ?? {};

    // Cooldown check — per-stop, per-user
    const checkins: Array<{ stopId: string; checkedInAt: string }> = Array.isArray(payload.ecoMapCheckins) ? payload.ecoMapCheckins as any : [];
    const lastCheckin = [...checkins].reverse().find(c => c.stopId === stop.id);
    if (lastCheckin) {
      const elapsed = Date.now() - new Date(lastCheckin.checkedInAt).getTime();
      if (elapsed < stop.cooldownHours * 3_600_000) {
        const remainH = Math.ceil((stop.cooldownHours * 3_600_000 - elapsed) / 3_600_000);
        return NextResponse.json({ success: false, error: { code: "ecostop/on-cooldown", message: `You already checked in here. Come back in ~${remainH}h.` } }, { status: 429 });
      }
    }

    const imageHash = createImageHash(photo.buffer);
    const existingPhoto = await getExistingPhotoHash(imageHash);
    if (existingPhoto && existingPhoto.user_id !== userId) {
      return NextResponse.json({
        success: false,
        error: {
          code: "ecostop/photo-already-used",
          message: "This photo has already been used by another user. Please submit a unique photo."
        }
      }, { status: 409 });
    }

    const verification = await verifyImageWithProvider(
      photo.buffer,
      userId,
      `ecostop:${stop.id}`,
      `EcoStop check-in at ${stop.name}: ${stop.description}`,
      photo.mimeType
    );

    if (!verification.verified) {
      return NextResponse.json({
        success: false,
        error: {
          code: "ecostop/photo-verification-failed",
          message: verification.details || "Photo verification failed. Please take a clearer photo at this EcoStop.",
          warnings: verification.warnings ?? []
        }
      }, { status: 422 });
    }

    await savePhotoHash(imageHash, userId, `ecostop:${stop.id}`);

    // Grant rewards
    const xpAwarded  = stop.xpReward;
    const ecoAwarded = stop.ecoReward;
    const nextXp      = Number(payload.xp ?? 0) + xpAwarded;
    const nextEco     = Number(payload.ecoPoints ?? 0) + ecoAwarded;
    const nextLevel   = calculateLevelServer(nextXp);
    const newCheckin  = {
      stopId: stop.id,
      checkedInAt: new Date().toISOString(),
      distanceM: Math.round(distanceM),
      proof: "photo",
      verificationProvider: verification.provider
    };
    const nextCheckins = [...checkins, newCheckin].slice(-200); // keep last 200

    const nextPayload = {
      ...payload,
      xp: nextXp,
      level: nextLevel,
      ecoPoints: nextEco,
      ecoMapCheckins: nextCheckins,
      missionsCompleted: Number(payload.missionsCompleted ?? 0) + 1
    };

    await sql(
      `INSERT INTO users (id, email, password_hash, payload)
       VALUES ($1, $2, COALESCE((SELECT password_hash FROM users WHERE id = $1), ''), $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET email = excluded.email, payload = excluded.payload, updated_at = now()`,
      [userId, user.email, JSON.stringify(nextPayload)]
    );

    return NextResponse.json({ success: true, xpAwarded, ecoAwarded, stopName: stop.name });
  } catch (err: any) {
    console.error("EcoStop check-in error:", err);
    return NextResponse.json({ success: false, error: { code: "internal", message: err.message ?? "Server error" } }, { status: 500 });
  }
}

// Simple level calculator (mirrors lib/level-system.ts, no import needed here)
function calculateLevelServer(xp: number): number {
  let level = 1;
  while (xp >= 100 * level + 25 * level * level) level++;
  return level;
}
