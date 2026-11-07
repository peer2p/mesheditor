---
id: figure-sculptor
name: Figure Sculptor & Game Retopology (Anatomy, Proportions & Real-Time Topology)
description: Guidance for building, sculpting, and retopologizing organic figures (humanoids, animals, creatures) using anatomical canons (Loomis, Bammes, Goldfinger), deformation loops, and game-ready polycount budgets.
enabled: true
---

# Figure Sculptor & Game Retopology Skill

Use this skill whenever requested to create, sculpt, proportion, or retopologize organic 3D models: human figures, characters, animals, quadrupeds, fantasy creatures, head busts, facial features, or game-ready humanoid avatars.

---

## 1. Hierarchy of Forms (From Macro to Micro)

1. **Primary Forms (Silhouette & Volume)**:
   - Always establish overall silhouette, proportions, and center of gravity first before adding fine features.
   - If a character is not instantly recognizable and dynamic in pure black silhouette, interior details will not save it.
   - Decompose the body into fundamental 3D masses:
     - Head: Ellipsoid with flattened sides (temporal planes) and tapered jaw wedge.
     - Torso / Ribcage: Ovoid barrel cage tilted slightly backward ($5^\circ$).
     - Pelvis: Truncated wedge tilted slightly forward ($10^\circ$), creating the natural lumbar lordosis curve.
     - Glimbs: Interlocking tapered cylinders.
2. **Secondary Forms (Anatomical Landmarks)**:
   - Major muscular masses: Pectoralis major, Deltoids, Biceps/Triceps, Rectus abdominis, Gluteus, Quadriceps, Gastrocnemius (calves).
   - Invariable **Bony Landmarks** (always visible under skin):
     - Clavicles (collar bones) forming a wide "V" or bicycle handlebar shape.
     - Jugular notch at top of sternum ($Y = 1.50\text{m}$).
     - Acromion process of the shoulder.
     - 10th rib lower margin at waist ($Y = 1.15\text{m}$).
     - Anterior superior iliac spine (ASIS) of the hips.
     - Patella (kneecap) and tibial crest (shin bone).
     - Elbow olecranon and wrist styloid processes.
3. **Tertiary Forms (Fine Details)**:
   - Tendons, muscle separations, eyelid margins, nostril flares, lip contours, and skin folds.

---

## 2. Anatomical Proportions & Mathematical Canons (Human)

Babylon.js uses a left-handed coordinate system: **Y is up**, **X is width (left/right)**, **Z is depth (forward/back)**.
All figures must be standing on ground level **$Y = 0$** and centered at **$X = 0, Z = 0$**.

### The Loomis 8-Head Canon (Standard Heroic Game Character: $H = 1.80\text{m}$)

Each head unit is $\text{Unit} = \frac{1.80\text{m}}{8} = 0.225\text{m}$.

| Head Segment | Height Range ($Y$)              | Key Anatomical Landmarks                                                                                                                                    |
| ------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Head 1**   | $1.575\text{m} - 1.800\text{m}$ | Cranium crown ($1.80\text{m}$), Eye line (exact half of head, $1.687\text{m}$), Nose base ($1.63\text{m}$), Mouth ($1.60\text{m}$), Chin ($1.575\text{m}$). |
| **Head 2**   | $1.350\text{m} - 1.575\text{m}$ | Neck cylinder, Jugular notch ($1.50\text{m}$), Clavicle/Shoulder axis ($1.45\text{m}$), Nipple line ($1.35\text{m}$).                                       |
| **Head 3**   | $1.125\text{m} - 1.350\text{m}$ | Lower ribcage arch, Navel ($1.125\text{m}$), Elbow pivot line ($1.125\text{m}$).                                                                            |
| **Head 4**   | $0.900\text{m} - 1.125\text{m}$ | **Exact Body Midpoint ($0.5 \times H = 0.90\text{m}$)**: Pubic arch / Groin, Wrist line ($0.90\text{m}$), Greater trochanter (hip pivots).                  |
| **Head 5**   | $0.675\text{m} - 0.900\text{m}$ | Mid-thigh, Fingertips reach mid-thigh at $Y = 0.70\text{m}$.                                                                                                |
| **Head 6**   | $0.450\text{m} - 0.675\text{m}$ | **Lower Knee Cap / Patella ($0.25 \times H = 0.45\text{m}$)**. Knee joint flexes backwards.                                                                 |
| **Head 7**   | $0.225\text{m} - 0.450\text{m}$ | Calf belly (Gastrocnemius maximum diameter at $Y = 0.35\text{m}$).                                                                                          |
| **Head 8**   | $0.000\text{m} - 0.225\text{m}$ | Ankle malleoli ($Y = 0.08\text{m}$), Foot sole flat on ground ($Y = 0.00\text{m}$).                                                                         |

- **Width Proportions**:
  - Shoulders width (Deltoid to Deltoid): $2.0 \times \text{head width} \approx 0.45\text{m} - 0.50\text{m}$.
  - Waist width: $\approx 0.28\text{m} - 0.32\text{m}$.
  - Hips width: $\approx 0.34\text{m} - 0.36\text{m}$ (equal to chest width in athletic males, wider than chest in females).
- **Arm Span**: Outstretched fingertips from left to right equal total body height ($1.80\text{m}$).

---

## 3. Stylized & Cartoon Proportions (Chibi / Super Mario / Toon Canon)

When asked to create stylized cartoon characters, mascots, dwarves, toons, or iconic figures like **Super Mario**:
**NEVER use the 8-head realistic mannequin!** A realistic 8-head skeleton makes cartoon characters look uncanny and disproportioned. Use the **Chibi / Cartoon Canon (3.5 – 4 Heads)**:

1. **The 3.5-Head Cartoon Canon ($H \approx 1.20\text{m}$)**:
   - **Head ($\approx 35\%$ of total height)**: Large, expressive sphere/ovoid ($0.42\text{m} \times 0.38\text{m} \times 0.40\text{m}$) centered at $Y = 0.98\text{m}$. Features a prominent bulbous nose ($0.16\text{m}$) at $(0, 0.96, 0.22)$ and round ears at $(\pm 0.22, 0.98, 0)$.
   - **Torso / Potbelly**: Rounded barrel ovoid ($0.44\text{m} \times 0.34\text{m} \times 0.42\text{m}$) centered at $Y = 0.69\text{m}$, protruding forward ($Z = +0.03\text{m}$) for the iconic potbelly silhouette.
   - **Arms & T-Pose**: In T-Pose, arms extend horizontally along the X-axis from shoulders ($Y = 0.74\text{m}$) to wrists ($X = \pm 0.57\text{m}$) ending in large rounded cartoon gloves ($X = \pm 0.65\text{m}$, diameter $0.16\text{m}$).
   - **Legs & Boots**: Short sturdy legs ($Y = 0.16\text{m} - 0.42\text{m}$) with oversized, rounded cartoon boots ($0.26\text{m}$ long, $0.17\text{m}$ wide, $0.13\text{m}$ high) resting flat on ground $Y = 0$.
2. **Spawning the Cartoon Base Mesh**:
   - Call `modeler_spawn_base_mesh` with `type: "chibi"`, `pose: "t_pose"`, and `materialStyle: "colored"`.
   - This automatically creates the 3.5-head cartoon blockout in true T-Pose with pre-assigned PBR materials for skin, clothing, gloves, and boots!

---

## 4. Soft Organic Contours vs. Rigid Mannequin (How to Avoid the "Holzig" / Wooden Look)

A common flaw when proceduralizing characters is the **"Wooden Mannequin" (Gliederpuppe) syndrome**: stacking primitive cylinders and sphere ball-joints. Even when vertex buffers are merged, harsh intersecting seams remain visible, making the character look like a rigid wooden toy.

### The 4 Essential Rules for Soft, Continuous Organic Contours:

1. **Continuous Spline Limbs (`MeshBuilder.CreateTube`)**:
   - **NEVER** build organic limbs out of disjoint cylinders with sphere joints!
   - Construct limbs as continuous, smoothly curved 3D paths using `MeshBuilder.CreateTube`.
   - Use `radiusFunction: (index, distance) => number` to smoothly taper limbs from shoulder/hip through elbow/knee down to wrist/ankle.
   - Example arm tube path:
     ```javascript
     const armPath = [
       new Vector3(side * 0.18, 0.65, 0.02), // Shoulder
       new Vector3(side * 0.32, 0.5, 0.07), // Curved elbow
       new Vector3(side * 0.42, 0.35, 0.13), // Wrist
     ];
     MeshBuilder.CreateTube(
       "arm",
       {
         path: armPath,
         radiusFunction: (i) => (i === 0 ? 0.07 : i === 1 ? 0.055 : 0.045),
         tessellation: 16,
         cap: Mesh.CAP_ALL,
       },
       scene,
     );
     ```

2. **Unified Organic Volumes (Pear / Teardrop Silhouette)**:
   - For cute, stylized, or creature models (such as Chibi characters, imps, demons, and mascots), unite the head and potbelly into **one continuous pear-shaped volume** (e.g. `MeshBuilder.CreateSphere` with non-uniform scaling `(1.08, 1.25, 0.98)` or a smooth capsule).
   - Eliminating the separate neck cylinder immediately removes the robotic look.

3. **Subdivision Surface (Sub-D) Smoothing (`modeler_subd_smooth`)**:
   - When joining components or box-modeling cages, apply `modeler_subd_smooth` with `iterations: 1` or `2`.
   - Sub-D midpoint subdivision combined with Laplacian vertex relaxation automatically welds and fillets sharp intersection creases into soft, organic skin transitions.

4. **Satin Specular PBR Shading**:
   - High roughness ($\ge 0.8$) flattens lighting and turns models into chalky, unappealing clay.
   - Soft organic skin requires **PBR roughness between $0.35$ and $0.45$** with subtle metallic ($0.0 - 0.05$). The resulting soft specular glint accentuates the smooth curvature of the silhouette.

---

## 5. Multi-Material Assignment & PBR Satin Specularity

A finished character must **NEVER be left as a single uncolored clay lump**. Every character requires distinct, vibrant PBR materials with appropriate gloss:

| Character Element       | PBR Albedo Color        | Roughness | Metallic | Notes                                                   |
| ----------------------- | ----------------------- | --------- | -------- | ------------------------------------------------------- |
| **Stylized Demon Skin** | `#c9182b` (Crimson Red) | 0.38      | 0.02     | Soft satin sheen showcasing curvaceous organic contours |
| **Horns & Halo**        | `#202024` (Charcoal)    | 0.45      | 0.10     | Matte horn texture / dark metallic ring                 |
| **Eyes (Sclera)**       | `#f0f0f5` (White)       | 0.25      | 0.00     | Glossy cartoon eyeball                                  |
| **Pupils**              | `#111114` (Jet Black)   | 0.50      | 0.00     | Horizontal slit cartoon pupils                          |
| **Fangs / Teeth**       | `#ffffff` (Pure White)  | 0.30      | 0.00     | Smooth enamel fangs                                     |
| **Human / Chibi Skin**  | `#f5c59e` or `#f8c8a0`  | 0.50      | 0.00     | Warm cartoon peach skin tone                            |
| **Mario Red Cap**       | `#e52521`               | 0.45      | 0.00     | Iconic Nintendo vermilion red                           |
| **Swimming Trunks**     | `#002fbe` (Royal Blue)  | 0.45      | 0.05     | Blue swim shorts with `#ffffff` waistband               |
| **Cartoon Gloves**      | `#f5f5f5`               | 0.40      | 0.00     | Soft white fabric with rolled wrist cuffs               |
| **Boots / Shoes**       | `#5c2c16`               | 0.70      | 0.00     | Deep leather brown                                      |

---

## 6. Recipe: Stylized Organic Creature / Chibi Demon (Soft Contours)

To generate a cute, stylized organic creature or imp (soft red skin, curved horns, digitigrade legs, bat wings, halo, pitchfork):

1. **Step 1: Spawn Organic Base Mesh**:
   - Call `modeler_spawn_base_mesh`:
     ```json
     { "type": "creature", "name": "chibi_demon", "materialStyle": "colored" }
     ```
   - This automatically creates the seamless pear body, continuous curved tubular limbs, claws, horns, wings, halo, and eyes with soft satin PBR red skin!

2. **Step 2: Sub-D Smoothing & Sculpting (Optional)**:
   - Call `modeler_subd_smooth` with `iterations: 1` if extra organic curvature is desired.
   - Use the `clay` or `smooth` brush with low radius ($0.25$) to shape brow ridges or cheek volume.

3. **Step 3: Game Retopology**:
   - Call `modeler_retopologize_mesh` with `targetFaces: 4000` (for mobile) or `12000` (for standard game).
   - This applies Quadric Error Metric decimation and recalculates smooth vertex normals so all silhouettes stay silky smooth.

---

## 7. Recipe: Super Mario Like Heroes (Soft Organic Chibi)

When building Super Mario in swimming trunks (T-Pose):

1. **Step 1: Spawn Chibi Base Mesh in T-Pose**:
   - Call `modeler_spawn_base_mesh`:
     ```json
     {
       "type": "chibi",
       "pose": "t_pose",
       "name": "hero_base",
       "materialStyle": "colored",
       "style": "organic"
     }
     ```
   - Setting `"style": "organic"` ensures limbs are generated as smooth continuous tubes without disjoint sphere joints!

2. **Step 2: Organic Sculpting**:
   - Call `modeler_sculpt_mesh` to accentuate organic facial planes or cheeks:
     ```json
     {
       "meshName": "hero_base",
       "brush": "inflate",
       "strokes": [
         { "x": 0.12, "y": 0.96, "z": 0.18, "radius": 0.22, "strength": 0.45 }
       ],
       "symmetryX": true
     }
     ```
   - _Note on `modeler_subd_smooth`_: The organic chibi base mesh already features smooth continuous curved surfaces (~4,000 tris). `modeler_subd_smooth` is designed for low-poly angular blockout cages; do not apply it to already dense organic meshes to avoid unnecessary polygon bloat.

3. **Step 3: Merge Meshes Preserving Multi-Materials**:
   - Call `modeler_merge_meshes` with `meshNames: ["*"]`, `newName: "hero_name"`.
   - All distinct PBR materials (e.g. skin, hair, shirt, pants, shoes) are preserved in a unified MultiMaterial!

4. **Step 4: Retopologize to Target Budget**:
   - Call `modeler_retopologize_mesh` with `targetFaces: 4000` (or the requested budget).
   - Simplifies the geometry to the exact real-time polygon budget while keeping silhouette and smooth normals.

---

## 6. Quadruped & Creature Anatomy (Goldfinger & Whitlatch Principles)

When creating animals, monsters, or fantasy quadrupeds (wolves, horses, dragons, big cats):

1. **Locomotion Leg Mechanics**:
   - **Plantigrade** (Human, Bear): Flat foot.
   - **Digitigrade** (Canine, Feline, Wolf):
     - The backward-pointing joint is the **elevated hock/heel** ($Y \approx 0.25\text{m} - 0.35\text{m}$), NOT the knee!
     - The true knee (stifle) is located high up at the flank ($Y \approx 0.55\text{m}$) pointing forward.
     - The animal walks on its toes/metatarsals.
   - **Unguligrade** (Equine, Bovine, Deer):
     - Walks on the very tips of third phalanges (hooves).
     - Hock and knee are placed high up for extreme spring-lever mechanics.
2. **Torso & Spine Balance**:
   - Ribcage barrel is oriented along the **Z-axis** (depth), suspended between the front scapular sling and rear pelvic girdle.
   - Scapula (shoulder blade) glides freely over the ribcage; it is connected to muscles, not a rigid collarbone.
   - Neck emerges from the chest at an upward $30^\circ - 45^\circ$ angle.

---

## 7. Game-Ready Retopology & Deformation Edge Loops (Hippydrome Rules)

High-poly sculpted meshes cannot be animated or rendered in real time. They must be retopologized into clean low/mid-poly cages with deformation loops:

1. **Polygon Budgets for Real-Time Engines**:
   - **Mobile / WebGL / Hypercasual**: 2,500 – 6,000 triangles.
   - **Standard Action Game / Indie PC / Console**: 12,000 – 25,000 triangles.
   - **Hero Character / Cinematic Asset**: 30,000 – 60,000 triangles.
2. **Joint Articulation Loops (3-Loop Rule)**:
   - At every bending joint (elbows, knees, finger phalanges):
     - Place **at least 3 parallel edge loops** across the articulation zone.
     - When the joint bends up to $120^\circ - 140^\circ$, the outer loop stretches, the middle loop holds volume, and the inner loop pinches without collapsing the mesh into a paper-thin wedge.
3. **Facial Contour Loops**:
   - Concentric circular loop masks around eyes (_orbicularis oculi_) for blinking.
   - Concentric loop rings around mouth (_orbicularis oris_) for speech phonemes.
   - Nasolabial fold loop running from nostril wings down past the mouth corners.
4. **Poles & Valence Management**:
   - **5-Poles (E-poles)** and **3-Poles (N-poles)** must be kept away from dynamic deformation zones (armpits, knee hollows, eyelid folds).
   - Route poles to rigid, static surface regions (e.g. temple, outer thigh, shoulder plate).

---

## 8. Tool Pipeline in Mesh Editor

When building or updating figures, combine these built-in tools:

1. **Step 1: Choose the Right Organic Base (SDF Clay, Base Mesh, or Clay Sphere)**:
   - **Option A — Smooth Organic SDF Clay (`modeler_create_sdf_mesh`)**:
     - Best for seamless, watertight organic torsos, heads, creatures, muscles, and stylized characters without hard primitive seams.
     - Combine `ellipsoid`, `sphere`, `round_cone` (tapered capsules from `start` to `end` with `radius` and `endRadius`), and `box` (with `rounding`) using `blend: 0.04` to `0.12` and `symmetryX: true`. Use `op: "subtract"` to carve eye sockets or mouth cavities.
   - **Option B — Anatomical Base Mesh (`modeler_spawn_base_mesh`)**:
     - `type: "chibi"` (`style: "organic"`): 3.5-head cartoon blockout in T-Pose with pre-assigned PBR materials.
     - `type: "creature"`: Stylized organic creature / demon base mesh.
     - `type: "humanoid"`: 1.80m Loomis mannequin with joint rings (`pose: "t_pose"`).
     - `type: "quadruped"`: Animal base with digitigrade/unguligrade leg mechanics.
     - `type: "head_bust"`: Head with facial planes, eye cavities, and neck.
   - **Option C — Clay Sphere Sculpting (`type: "sculpt_sphere"` + `modeler_sculpt_mesh`)**:
     - **User Intent Priority**: Whenever the user explicitly asks to sculpt or model from a clay sphere (`sculpt_sphere`), **ALWAYS honor that request!**
     - First spawn `modeler_spawn_base_mesh` with `type: "sculpt_sphere"` (or `modeler_create_sdf_mesh`), then call `modeler_sculpt_mesh` using continuous stroke paths (`from: {x,y,z}`, `to: {x,y,z}`, `steps`, `radius`, `strength`, `symmetryX: true`):
       - `"grab"`: Drag primary silhouettes outward (jawline, chin, nose bridge, brow ridge, ears, horns, neck).
       - `"clay"` / `"inflate"`: Build up cheek mass, lips, brow muscles, and anatomical volumes along surface normals (`invert: true` to carve eye sockets and cavities).
       - `"pinch"`: Sharpen eyelid folds, lip vermilion borders, and nasolabial creases.
       - `"flatten"`: Plane off temple, forehead, and jaw flats.
       - `"smooth"`: Relax transitions and polish the surface.

2. **Step 2: Proportional Polygon Budget Rule (Eye vs. Torso)**:
   - **Primary Volumes (50–65% of budget)**: Torso, cranium, pelvis, main body.
   - **Secondary Volumes (25–35% of budget)**: Arms, legs, hands, boots, hair, hats.
   - **Tertiary Details (< 10% of budget)**: Eyeballs, pupils, buttons, buckles, teeth, fingernails.
   - **CRITICAL**: Never give a small tertiary detail (like an eyeball) more triangles than the torso! When adding eyes or buttons via `modeler_create_primitive`, always pass `detailTier: "tertiary"` or `options: { segments: 6 }` (~190 triangles instead of 2,700). Call `modeler_plan_model` first on multi-part characters to verify proportional polygon allocation.

3. **Step 3: Box-Modeling & Proportional Edits**:
   - Use `modeler_facet_extrude` to pull out horns, armor plates, tails, or wings.
   - Use `modeler_facet_inset` to recess eye sockets or wound portals.
   - Call `modeler_subd_smooth` with `iterations: 1` or `2` to relax blockout polygons into smooth organic curvature.
4. **Step 4: Game-Ready Retopology & Optimization**:
   - Call `modeler_retopologize_mesh` with `targetFaces` matching the user's polygon budget (e.g. `4000` for WebGL/mobile, `15000` for standard game characters).
   - This applies Quadric Error Metric simplification, preserves silhouettes, and recalculates smooth vertex normals.
5. **Step 5: PBR Material & Normal Maps**:
   - Call `modeler_create_material` with PBR skin/clay parameters:
     - Skin / Clay: `albedoColor: "#d9b38c"`, `roughness: 0.65`, `metallic: 0.0`.
     - Normal maps: Use `normalMapUrl` or procedural surface relief with `bumpLevel: 1.2` to retain fine wrinkles and skin pores without polygon overhead.
