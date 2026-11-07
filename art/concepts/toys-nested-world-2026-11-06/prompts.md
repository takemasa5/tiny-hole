# 生成プロンプト

組み込み image_gen ツールを使用。

## A 初回全体図

```text
Use case: stylized-concept
Asset type: a polished game concept art storyboard, a Japanese design approval board, NOT a screenshot of an implemented game.
Primary request: Show a swallowing-hole game whose theme is NESTED CONTAINERS AND THE REAL WORLD BECOMING SMALL THROUGH GROWTH: a tiny cluttered notions box INSIDE a large toy chest INSIDE a child's bedroom INSIDE a real house INSIDE a real city. This nested progression is the entire point. This is NOT a collection of neatly arranged miniature buildings or a theme park.
Composition: large landscape concept board, five clearly separated richly detailed panels arranged in reading order, two panels on the first row, two on the second, one panoramic city panel across the bottom. Clear cream gutters, very short readable Japanese headings, small arrows linking stages. Cute tactile low-poly 3D videogame art, warm light, simple clean shapes like an approachable 3D hole game, angled overhead playable-ground views and cutaway outer walls. Maintain identity of the same striped-lid cardboard notions box, same teal wooden toy chest, same wooden-floor child's bedroom with blue bed and yellow desk, same red-roofed house across successive panels. The previous setting must visibly become a small object inside the next setting. The swallowing hole is always a flat black circular opening with a thin violet edge on the walkable floor, never a sphere, player character or monster. Its apparent size remains broadly consistent within each panel while objects become small relative to it.

Title text verbatim: "小さな箱の中から、街を飲み込む大きさへ"
Small subtitle text verbatim: "今いた場所が、次の世界の小さな一部になる"

Panel 1 heading verbatim: "1　小物箱の中"
View DOWN INSIDE a cardboard notions box. Its walls surround the floor and visually block travel, close and tall relative to the tiny hole. Loose buttons, beads, thread spools, paper clips, puzzle pieces mixed in messy overlapping heaps and little spills, not orderly rows or separate product samples. Begin at button scale. Include an iconic red four-hole button. No huge furniture on this floor; this is genuinely inside a little box.

Panel 2 heading verbatim: "2　おもちゃ箱"
View INSIDE a much larger teal wooden toy chest. The SAME cardboard notions box is now visibly small and lies among jumbled toy blocks, teddy bears, dolls, model cars and train pieces. The chest's own enclosing side walls form the new walkable boundary. The lid is open above the scene, not a ceiling covering the action. Do not arrange the toys in neat rows; make natural playful clutter and some piles.

Panel 3 heading verbatim: "3　子供部屋"
A real child's bedroom with clearly room-scale yellow desk and blue bed towering over the hole and floor toys: the furniture is FAR TOO LARGE to swallow at entry into this space. The same teal toy chest now sits as a small furnishing against a wall, with the original little cardboard box visible inside. Wooden floor with a toy railway loop and a separate toy road layout, several fast toy trains and cars flowing along these paths, subtle motion streaks and direction cues. Tall room walls and one ordinary closed bedroom door define the boundary. A small side arrow beside the door, with this caption verbatim: "成長するとドアが開く". Walls are architectural walls, no traffic-cone fence, no floating invisible border.

Panel 4 heading verbatim: "4　家の中"
A coherent cutaway floor plan of ONE REAL HOUSE, not a dollhouse exhibition. Show a connected child's bedroom, living room with sofa, kitchen with fridge and countertop, and Japanese entryway with shoes, all at one traversable floor elevation. The same child's bedroom and toy chest can be recognized in a corner and are small parts of the house now. The hole has grown enough that furniture is becoming swallowable. The house exterior walls define a real boundary; the front door toward the street is opening. Caption verbatim near the exit: "成長すると玄関が開く". NO stairs, jumping, ladders or teleport portals.

Panel 5 heading verbatim: "5　街と巨大な最終目標"
A REAL city, actual streets, real cars and houses, office buildings and taller apartment buildings, not a toy city or film set. The same red-roofed house is now a small object near the hole. The hole is now large enough to swallow houses and then buildings. At the far end of this city stands a single ORIGINAL colossal blue-and-silver robot as the final target, dramatically larger than the existing prototype: its legs dwarf houses, its torso rises well above several tall buildings, its upper body dominates the skyline. Give it a readable simple original silhouette, no licensed characters, no logos. The city should make the tiny beginning feel astonishingly small. The final target must feel like a distant, much larger challenge rather than a toy among other toys. It is a concept for later growth, do not label numerical dimensions or levels.

Constraints: nested scale continuity is more important than decorative polish. Each panel must have real containing walls or a doorway. Clutter in the boxes; intelligible furniture arrangement in the room and house; road traffic in the city. NO toy showroom rows, no symmetrical product grids inside the scenes, no traffic cones, no arbitrary stage portals, no extra sixth stage, no HUD, no health bars, no timers, no leveling UI, no watermarks. Only the specified Japanese titles and brief captions.
```

## A 修正指示

```text
Edit the provided concept storyboard. Preserve the existing five-panel composition, all exact Japanese text, typography, artwork style, lighting, character designs and the nested progression. Make ONLY these targeted changes:
1. In panel "2 おもちゃ箱", make the toys genuinely MESSY AND JUMBLED. They are loosely tossed in overlapping heaps, some blocks tipped on their sides, a doll reclining diagonally against a teddy bear, cars at different angles, train pieces partly disassembled and partly buried, beads and blocks scattered over the floor. Keep the identifiable pink-striped little notions box visible inside the teal toy chest, with its lid open and its clutter visible. Keep the flat black violet-rimmed hole clearly visible on the chest bottom. Do NOT line up dolls, books, blocks, cars and trains neatly like a shop display. This is a child's used toy chest.
2. In panel "4 家の中", REMOVE the small black hole in the child's bedroom. Put ONE larger black violet-rimmed hole on the open central wooden hallway floor of the house instead; its apparent diameter should be about the same as the hole in panel "3 子供部屋", and it should be large relative to the chair and coffee table. This represents growth into the whole house. Preserve the recognizable child's bedroom, kitchen, living room, entrance and opening front door. Do not add a second hole.
Keep panels 1, 3 and 5, especially the enormous final robot towering above real city buildings, exactly as they are. No extra text, no extra panels.
```

## B 初回子供部屋

```text
Use case: stylized-concept
Asset type: a two-panel game concept painting for design approval, not an implemented-game screenshot.
Primary request: A swallowing-hole game in a REAL child's bedroom, showing the SAME physical room at TWO player scales. The world is nested: the player just emerged from a toy chest which contains a small notions box. As the hole grows, the camera pulls back; furniture becomes relatively small and the bedroom door opens into the living room of the SAME house. Make this exact environmental continuity unmistakable.

Style: welcoming tactile 3D videogame concept art, legible simple shapes with a little material texture, warm daylight, wooden floor, colorful toys, angled overhead GAMEPLAY VIEW centered on a flat black hole with a narrow violet rim. No player character. This should feel like playing on a bedroom floor, not looking at a sterile architectural model or a toy showroom.

Composition: wide landscape image with two equally sized side-by-side panels, a slim cream gutter and a small unobtrusive connecting arrow in the gutter. Same screen-space hole diameter in each panel, about one-sixth of each panel width; hole always central on a walkable horizontal wooden floor. The hole's physical size increases greatly from left to right; the camera pulls much farther back on the right. Perspective, composition and visible furniture extents must demonstrate this, without numerical scale labels.

Title verbatim at top: "子供部屋：成長で見える範囲が広がる"
Left panel heading verbatim: "入室直後"
Right panel heading verbatim: "成長後"

Room identity in BOTH panels: blue bed with star-pattern bedding against the left wall, a yellow writing desk and chair toward the back, an open teal wooden toy chest toward the right wall with a smaller pink-striped cardboard notions box visibly inside it, and one ordinary wooden BEDROOM door in the back/right wall. The toy chest contains a MESSY, JUMBLED, overlapping pile of blocks, teddy bears, dolls, train pieces, beads and model cars, not orderly standing rows. A few toys spill onto the floor. A toy railway loop and a separate play-road layout lie flat ON the bedroom floor. Multiple fast little trains and cars actually travel along these paths, visible subtle speed streaks and direction cues. They are small compared with the desk and bed. Room walls are real boundaries, not traffic cones.

LEFT: a low, close, angled-overhead viewpoint near the wooden floor. The hole is small relative to the ROOM. Desk and bed are gigantic, far too large to swallow, with bed frame and chunky furniture legs looming at panel edges; part of the bed and desk must be cropped out because the camera is close. The teal toy chest behind the floor action is also much larger than the hole. Trains and cars zip past nearby. The ordinary bedroom door is CLOSED, visibly enclosing the room. Brief caption verbatim: "机やベッドは、まだ飲み込めない"

RIGHT: the SAME bedroom and the SAME furniture identities from a much wider, farther overhead view. The flat hole is the SAME SIZE IN PIXELS as the left panel, but now the toy chest and chair are SMALL relative to it and swallowable; the whole bed, desk, chest and railway are visible as parts of one room. The hole is large enough for furniture to start becoming targets. The ordinary bedroom door is OPEN, and through it the wooden floor continues at the same elevation into a real living room with a large sofa and coffee table. The doorway is a natural architectural exit, no magical portal. Brief caption verbatim: "ドアが開き、家の中へ"

Constraints: the two panels depict one unchanged room at different growth stages, not two unrelated rooms. Preserve the same physical furniture dimensions, positions and colors between views. Only the hole's world-space size and camera distance change; the door changes from closed to open. Furniture does NOT move, shrink physically, grow with the player, or turn into miniatures. Natural messy toy clutter. Flat walking surface with enclosing walls. No stair climbing, no jumping, no HUD, no timers, no health bars, no level numbers, no traffic-cone fence, no giant heroes inside the bedroom, no neat rows of product samples, no watermark. Only specified Japanese text.
```

## B 修正指示

```text
Edit this two-panel concept image. Preserve the LEFT panel completely, all Japanese titles and captions, warm tactile 3D art style, and the identities/colors of all room objects. Change ONLY the RIGHT panel to show a much greater growth step:
The right-hand camera must pull back about THREE TIMES farther and become more overhead. Show the ENTIRE same child's bedroom as a clearly bounded room, including its floor outline and the doorway into the living room. Use a cutaway wall where needed for visibility, not a dollhouse showcase. Keep the same blue star-pattern bed on the left, yellow desk at the back, teal toy chest at the right/back with the little pink-striped notions box inside, floor railway and play road in the same locations. These objects KEEP their real dimensions and positions but occupy much fewer pixels because the camera is farther away.
Keep the right-hand flat black violet-edged swallowing hole the SAME PIXEL DIAMETER as the hole in the unchanged LEFT panel. This is crucial. With the much farther camera, the hole now occupies a much larger real floor footprint: the entire toy chest should appear distinctly SMALLER than the hole, the chair small enough to swallow, and the bed width comparable to the hole diameter while its length is larger. The desk and bed are now plausible upcoming targets instead of towering background scenery. Cars, blocks and trains are very small now. Show the ordinary bedroom door OPEN with connected living-room floor, sofa and coffee table visible beyond it. No steps, no staircase, no magical portal.
Make the growth difference immediately obvious from the relationship between hole, furniture and room boundaries. The right panel should be an overhead playable room-and-door view, not another close interior photograph with a tiny hole. The hole stays near the center of its panel. Do not merely enlarge the hole on the existing close-up image: change the camera distance and projected sizes of the entire room as specified. Preserve all existing Japanese text EXACTLY and do not add extra text or panels.
```
