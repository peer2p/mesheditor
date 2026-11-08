/**
 * AI Quick Prompts Definition and Catalog.
 * Centralized registry of modeling prompt presets with technique tags,
 * detailed modeling instructions, and reference image support.
 */

export interface AIQuickPrompt {
  id: string;
  title: string;
  technique: string;
  category?: string;
  tag: string;
  description: string;
  prompt: string;
  image?: string;
  images?: string[];
}

export const AI_QUICK_PROMPTS: AIQuickPrompt[] = [
  {
    id: 'sdf_dragon',
    title: 'Dragon Whelp',
    technique: 'sdf',
    tag: 'SDF',
    category: 'Smooth Sculpting & SDF',
    description: 'Smooth clay union of primitives & surface nets',
    prompt:
      "Plan with modeler_plan_model, then use modeler_create_sdf_mesh (resolution: 56, taubinIterations: 6) to sculpt a smooth, seamless baby dragon sitting on its hind legs. Blend ellipsoid and tapered capsule primitives with smooth union (op: 'union', k: 0.14) and mirrorX: true for the torso, belly, curved neck, snout, lower jaw, haunches, forelegs, bat-like wing arms, curved horns, and a curling tail. Carve shallow eye sockets with op: 'subtract', then add two small glossy eye spheres with modeler_create_primitive (detailTier: 'tertiary', diameter: 0.07) so the eyes use far fewer polygons than the body.",
  },
  {
    id: 'clay_gargoyle',
    title: 'Sphere Bust',
    technique: 'clay_sphere',
    tag: 'Clay',
    category: 'Organic & Sculpting',
    description: 'Sculpting from a digital clay sphere with directional brushes',
    prompt:
      "Spawn a digital clay sphere using modeler_spawn_base_mesh (type: 'sculpt_sphere', name: 'Clay_Gargoyle_Bust'). Then sculpt an expressive stylized gargoyle head bust directly from the clay sphere using modeler_sculpt_mesh with symmetryX: true and subdivideIfCoarse: true: use directional 'grab' strokes (from -> to) to pull out the jaw, chin, cheekbones, pointed ears, and swept-back horns; use 'clay' and 'inflate' strokes to build the heavy brow ridge, nose bridge, and muzzle; use 'crease' strokes to carve the eye sockets and grinning mouth; and finish with 'smooth' and a weathered stone PBR material.",
  },
  {
    id: 'temple_portico',
    title: 'Temple Portico',
    technique: 'architecture',
    tag: 'Arch',
    category: 'Classical Architecture',
    description: 'Stepped podium, fluted Ionic columns, plinth & gable roof',
    prompt:
      "Plan with modeler_plan_model, then build a classical Greco-Roman temple portico using parametric architecture tools: 1) a stepped stone podium and front staircase with modeler_create_stairs (type: 'straight', width: 3.2, height: 0.6, depth: 1.2, steps: 6), 2) four fluted Ionic columns along the front porch using modeler_create_column (style: 'ionic', height: 3.0, radius: 0.22, flutes: 20, entasis: 0.04), 3) a sanctuary wall behind the columns using modeler_create_wall with an arched central doorway and two arched side windows with frames, plinth, and cornice, 4) a perimeter frieze with modeler_create_molding, and 5) a pitched terracotta roof with overhang using modeler_create_roof (style: 'gable').",
  },
  {
    id: 'gothic_courtyard',
    title: 'Arch & Spiral Stairs',
    technique: 'gothic',
    tag: 'Gothic',
    category: 'Medieval & Gothic',
    description: 'Pointed stone archways, lancet window wall & spiral stairs',
    prompt:
      "Build a medieval Gothic courtyard ruin corner using parametric architecture tools: create two pointed stone archways with modeler_create_arch (style: 'pointed', span: 2.2, height: 3.4, keystone: true, impost: true), connect them to a stone wall using modeler_create_wall featuring two pointed Gothic lancet window openings (shape: 'pointed', hasFrame: true, hasSill: true) and a ground-level arched doorway, crown the wall with a stepped cornice via modeler_create_molding, and place a stone spiral staircase alongside it using modeler_create_stairs (type: 'spiral', height: 3.4, outerRadius: 1.3, turns: 1.25, centralColumn: true, railing: 'both').",
  },
  {
    id: 'treasure_chest',
    title: 'Treasure Chest',
    technique: 'bevel',
    tag: 'Bevel',
    category: 'Hard-Surface & Props',
    description: 'Ornate oak & iron chest with rounded boxes & sweep handles',
    prompt:
      "Plan with modeler_plan_model, then build an ornate medieval oak and forged-iron treasure chest with smooth beveled edges: use modeler_create_rounded_box (bevelRadius: 0.04, bevelSegments: 3) for the wooden chest body, beveled iron corner brackets, and reinforcement straps. Add a vaulted barrel lid, a front brass lock plate with keyhole, and two curved side carry handles using modeler_create_tube. Keep small rivets and hinges in detailTier: 'tertiary' so they stay lightweight, and apply weathered oak and brushed gold PBR materials.",

  },
  {
    id: 'alchemist_flask',
    title: 'Alchemist Flask',
    technique: 'lathe',
    tag: 'Lathe',
    category: 'Rotational & Sweep',
    description: 'Profile-lathed glass body, emissive mana core & filigree handles',
    prompt:
      "Build an ornate alchemist potion vessel using rotational and sweep modeling: 1) use modeler_create_lathe with a 12-point silhouette profile to turn a flared pedestal foot, a ribbed bulbous glass body, a slender collared neck, and a flared pouring lip, 2) create a glowing emissive mana core inside the bulb, 3) add a tapered cork stopper on top, and 4) sweep two S-curved golden filigree handles along the sides using modeler_create_tube.",

  },
  {
    id: 'stylized_knight',
    title: 'Stylized Hero Figurine',
    technique: 'figure',
    tag: 'Figure',
    category: 'Character & Retopo',
    description: 'Proportional chibi base mesh, sculpted armor & retopology',
    prompt:
      "Spawn an organic stylized character base mesh using modeler_spawn_base_mesh (type: 'chibi', pose: 'a_pose', style: 'organic', coloredMaterials: true). Refine the torso and facial planes using modeler_sculpt_mesh with symmetryX: true, then equip the character with beveled shoulder pauldrons and a belt buckle using modeler_create_rounded_box, a knight helmet visor, and a cape. Keep small rivets and buckles in detailTier: 'tertiary', and finish with modeler_retopologize_mesh (targetFaces: 12000, symmetryX: true).",
    image: 'promptImages/mario_tpose.png',
  },
  {
    id: 'planetary_gear',
    title: 'Planetary Gear',
    technique: 'csg',
    tag: 'CSG',
    category: 'Mechanical & Precision',
    description: 'CSG boolean subtraction, shaft bores & radial gear tooth array',
    prompt:
      "Build a precision steampunk planetary gear wheel assembly: create the main bronze gear rim, use modeler_csg_boolean (operation: 'subtract') to carve out a central shaft bore and 6 circular weight-reduction holes around the web, distribute 16 beveled gear teeth evenly around the outer perimeter using modeler_clone_array (mode: 'radial', count: 16), and add a central steel hub with small hex bolts (detailTier: 'tertiary').",
  },
  {
    id: 'voxel_island',
    title: 'Floating Island',
    technique: 'voxel',
    tag: 'Voxel',
    category: 'Voxel & Terrain',
    description: 'Multi-material voxel grid, torii gate, waterfall & cherry tree',
    prompt:
      "Use modeler_build_voxel_mesh (voxelSize: 0.2) to construct a multi-material voxel floating island: build tapered dark-stone cliff layers underneath, grassy terraced terrain on top, a traditional red torii gate and stone lantern with a warm emissive light core, a cascading blue voxel waterfall on the front edge, and a cherry blossom tree with pink canopy clusters.",

  },
  {
    id: 'mesh_update',
    title: 'Mesh Update',
    technique: 'update',
    tag: 'Edit',
    category: 'Selection & Refinement',
    description: 'Inspect selected mesh, add beveled trim & upgrade materials',
    prompt:
      "Inspect the currently selected mesh (or active scene): add beveled trim or architectural molding around its primary silhouette using modeler_create_rounded_box or modeler_create_molding, carve recessed surface details with modeler_csg_boolean, and upgrade its PBR materials with procedural surface textures and normal maps.",
  },
  {
    id: 'stone_pillar',
    title: 'Ancient Fluted Pillar',
    technique: 'pillar',
    tag: 'Pillar',
    category: 'Classical Architecture',
    description: 'Monumental fluted column with decorative capital and marble PBR',
    prompt:
      "Build a monumental ancient fluted column using modeler_create_column (style: 'corinthian', height: 4.2, radius: 0.3, flutes: 24, entasis: 0.05). Add a stepped square marble pedestal underneath using modeler_create_primitive (shape: 'box', sizeX: 1.2, sizeY: 0.4, sizeZ: 1.2) with beveled base molding via modeler_create_molding, and top it with an ornate carved stone capital and weathered white marble PBR materials with subtle procedural micro-cracks.",

  },
  {
    id: 'vintage_cinema_chair',
    title: 'Vintage Cinema Chair',
    technique: 'seating',
    tag: 'Seating',
    category: 'Hard-Surface & Props',
    description: 'Folded velvet theater seat, cast-iron frame & cup holder',
    prompt:
      "Build a vintage cinema auditorium seat: 1) create the folding cushioned seat cushion and curved backrest with padded velvet PBR material using modeler_create_rounded_box, 2) construct ornate black cast-iron armrests and pedestal stanchions with floor mounting bolts, 3) add a wooden armrest top with an integrated round cup holder using modeler_csg_boolean, and 4) attach a small brass seat row number plate on the side.",
  },
    {
    id: 'cinema_chair',
    title: 'Cinema Theater Chair',
    technique: 'seating',
    tag: 'Seating',
    category: 'Hard-Surface & Props',
    description: 'Leather theater seat with lights and cup holder',
    prompt:
      "Build a leather cinema seat with lights and cup holder according to the input image",
    image: 'promptImages/cinema_chair.jpg',
  },
  {
    id: 'chibi_bathrobe',
    title: 'Hero in Cozy Bathrobe',
    technique: 'chibi_costume',
    tag: 'Costume',
    category: 'Character & Retopo',
    description: 'Stylized character with custom sculpted bathrobe and belt sash',
    prompt:
      "Spawn a chibi character base mesh using modeler_spawn_base_mesh (type: 'chibi', pose: 'a_pose', style: 'organic'). Sculpt a plush wrap-around bathrobe over the character body using modeler_sculpt_mesh: build a thick draped shawl collar around the neck, add a tied waist belt sash with dangling knot ends, sculpt soft fabric folds around the sleeves, and apply a cozy warm fleece PBR material.",

  },
];

export function getAllQuickPrompts(): AIQuickPrompt[] {
  return AI_QUICK_PROMPTS;
}

export function getQuickPromptById(id: string): AIQuickPrompt | undefined {
  return AI_QUICK_PROMPTS.find((p) => p.id === id);
}

export function addQuickPrompt(prompt: AIQuickPrompt): void {
  const existingIdx = AI_QUICK_PROMPTS.findIndex((p) => p.id === prompt.id);
  if (existingIdx >= 0) {
    AI_QUICK_PROMPTS[existingIdx] = prompt;
  } else {
    AI_QUICK_PROMPTS.push(prompt);
  }
}

/**
 * Normalizes prompt image paths so they resolve consistently whether authored as:
 * - 'promptImages/my_image.png'
 * - 'src/promptImages/my_image.png'
 * - './promptImages/my_image.png'
 * - 'my_image.png' (automatically mapped to promptImages/...)
 * - 'screenshots/my_image.jpg'
 * - full http(s):// or data: URLs
 */
export function normalizePromptImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Preserve absolute URLs, data URIs, blob URIs
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  let clean = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;

  // Rewrite src/promptImages/ -> promptImages/
  if (clean.startsWith('src/promptImages/')) {
    clean = clean.replace('src/promptImages/', 'promptImages/');
  }

  // If bare filename without any directory slash, default to promptImages/
  if (!clean.includes('/')) {
    clean = 'promptImages/' + clean;
  }

  return clean;
}

