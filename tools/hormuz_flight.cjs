// (hormuz) Camera path over Ras Musandam, in the engine's cinematic format:
// (flight time s, x, y, z, lookX, lookY, lookZ, vfov deg); x east, z north, metres. Flown at 45-68 m/s and played
// back 3x (SPEED=3; the reference used 2.5x). Water and ships run in video time (tscale = 1/3).
module.exports = [
  [0, -330, 6, 4850, -380, 8, 4390, 58],   // open strait, low over the water; frigate ahead
  [6.3, -300, 4.5, 4550, -330, 6, 4350, 58],   // across the frigate's wake
  [12.3, -240, 5, 4280, 60, 12, 3920, 58],   // swing toward the tanker
  [18.3, -60, 10, 4060, 150, 14, 3885, 60],
  [24.4, 150, 34, 3880, 420, 10, 3550, 60],   // up and over the tanker's deck
  [30.5, 400, 22, 3620, 660, 40, 2900, 60],
  [36.5, 580, 12, 3260, 690, 50, 2500, 60],   // Musandam Island, north-west cliffs
  [47.1, 610, 14, 2600, 640, 40, 1900, 60],
  [56.6, 600, 18, 2000, 640, 30, 1300, 60],
  [64.8, 640, 20, 1500, 480, 30, 850, 60],
  [73.4, 520, 22, 1000, 200, 25, 560, 60],
  [80.6, 300, 20, 640, -200, 15, 420, 60],
  [89, -120, 16, 470, -560, 10, 250, 60],
  [97.5, -520, 12, 330, -650, 8, -100, 60],   // round the island's south-west point
  [104, -650, 9, 60, -503, 3, -286, 62],   // into the Fakk al Asad channel: two patrol boats coming up it
  [107, -648, 8.5, -70, -515, 3, -271, 62],   // the camera tracks the lead boat as it passes 70 m to port...
  [110.1, -640, 8, -200, -528, 3, -257, 62],
  [113.5, -610, 10, -360, -543, 3, -241, 62],
  [117.7, -560, 14, -560, -561, 2, -221, 60],   // ...and keeps looking back up the channel while it climbs away
  [126.7, -250, 50, -900, -640, 0, -130, 58],   // one long climbing left turn, pulling back from the channel
  [135.5, 300, 120, -1080, -600, 0, 0, 58],
  [144.5, 850, 230, -1000, -450, 0, 300, 56],
  [153.5, 1250, 380, -700, -350, 0, 650, 56],
  [161.5, 1350, 560, -520, -400, 0, 850, 57],
  [168.5, 1400, 640, -400, -450, 0, 900, 58],   // final aerial: island, channel, mainland hook, the strait and its ships beyond
];
