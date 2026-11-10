# PROMPT

## How this was built

- Model: Claude Fable 5.2 in Claude Code (desktop app), in one session on 2026-11-10.
- Starting point: a local clone of [Leonxlnx/napali](https://github.com/Leonxlnx/napali) by Leon Lin
  ([@LexnLin](https://x.com/LexnLin)), MIT. His engine does the heavy lifting; see the README for what changed.
- Inputs: Leon's post of the Na Pali flight as the style reference, OpenStreetMap coastline, Terrain Tiles
  elevation, and public photographs of the Musandam coast for the look (not included).
- No image, video or audio generation model was used. Picture and sound are code.
- Hardware: an M1 Pro MacBook. The final 1080p render took 4.5 hours.

## The original prompts (the user's words)

> hey can we create a drone video like this for the strait oof hormuz: [Leon Lin's post] this is the repo:
> https://github.com/Leonxlnx/napali tell me what you need to make it perfect

> okay fork leon

Asked what to build, the user chose: the Musandam side, tankers plus naval vessels with no on-screen text, a
full-quality overnight render, and no sound.

> i hope you didn't just copy the leon lin own, look online for the imagary of the strait to make it's accuarate

> Ras Musandam, go on

After the first preview: "Revise first". After the second: "Render now".

> Just one last thing, let's add audio to it. I don't want music, but add like natural sound of probably the ocean
> and waves and things like that.

> let's opensource the source code in a repo

## A prompt that recreates this project

Fork github.com/Leonxlnx/napali (a WebGL2 shader drone flight over the Na Pali coast, built as one generated
`index.html` with headless-Chrome render tools) and turn it into a flight over the Strait of Hormuz. Do not recolour
the Na Pali scene: build the real place.

1. **Get the engine running first.** Render the original contact sheet before changing anything. On Apple silicon
   expect to fix the Windows-only tooling, paths with spaces, and black blocks caused by `pow(x, 2.)` with negative
   `x` returning NaN on Metal.
2. **Pick a real site that fits the engine's world.** The strait is 39 km wide and the world is a few kilometres, so
   choose one dramatic piece of coast: Ras Musandam, Musandam Island and the Fakk al Asad channel, centred on
   26.3597 N, 56.5151 E, in a 6.4 km square. Download the OpenStreetMap coastline and 30 m elevation tiles, bake them
   into coastline loops and a height grid, and feed both into the terrain stage in place of the generated island.
3. **Match the look to photographs.** Find public photos of the Musandam coast and compare renders against them:
   pale tan limestone in tilted beds, no vegetation, no beaches, dust haze that swallows the horizon, a lower sun,
   calm dark water with turquoise only in the shallows. Switch off every original feature that is pinned to Na Pali
   coordinates (valley fill, valley mist, palms, surf fringe).
4. **Add ships as signed-distance shapes** ray-marched in the main shader: two laden tankers, a generic frigate and
   two fast patrol boats, each with a wake and a shadow on the water. Keep them generic, with no flags or names.
5. **Write a new camera path** in the engine's cinematic format: low over the open strait past the frigate and
   along the tanker's deck, in to the cliffs and along them, through the channel behind the patrol boats, then one
   long climbing turn to a wide aerial. Play it back 3x and run water and ships in video time.
6. **Keep all Hormuz changes in one post-build patch file** so the original parts stay readable, and make the build
   fail loudly if a patch no longer matches.
7. **Preview small, then render in crash-safe segments** at 1080p30 with 4 samples per frame, and review the result
   as contact sheets before calling it done.
8. **Synthesise the sound from the scene data**: sea wash that fades with height, surf scaled by distance to the
   coastline, engine rumble placed by each ship's distance and bearing, wind at altitude. No music.

Be honest in the write-up about what is real (coastline, elevation) and what is not (everything else).
