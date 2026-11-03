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

| Head Segment | Height Range ($Y$) | Key Anatomical Landmarks |
|---|---|---|
| **Head 1** | $1.575\text{m} - 1.800\text{m}$ | Cranium crown ($1.80\text{m}$), Eye line (exact half of head, $1.687\text{m}$), Nose base ($1.63\text{m}$), Mouth ($1.60\text{m}$), Chin ($1.575\text{m}$). |
| **Head 2** | $1.350\text{m} - 1.575\text{m}$ | Neck cylinder, Jugular notch ($1.50\text{m}$), Clavicle/Shoulder axis ($1.45\text{m}$), Nipple line ($1.35\text{m}$). |
| **Head 3** | $1.125\text{m} - 1.350\text{m}$ | Lower ribcage arch, Navel ($1.125\text{m}$), Elbow pivot line ($1.125\text{m}$). |
| **Head 4** | $0.900\text{m} - 1.125\text{m}$ | **Exact Body Midpoint ($0.5 \times H = 0.90\text{m}$)**: Pubic arch / Groin, Wrist line ($0.90\text{m}$), Greater trochanter (hip pivots). |
| **Head 5** | $0.675\text{m} - 0.900\text{m}$ | Mid-thigh, Fingertips reach mid-thigh at $Y = 0.70\text{m}$. |
| **Head 6** | $0.450\text{m} - 0.675\text{m}$ | **Lower Knee Cap / Patella ($0.25 \times H = 0.45\text{m}$)**. Knee joint flexes backwards. |
| **Head 7** | $0.225\text{m} - 0.450\text{m}$ | Calf belly (Gastrocnemius maximum diameter at $Y = 0.35\text{m}$). |
| **Head 8** | $0.000\text{m} - 0.225\text{m}$ | Ankle malleoli ($Y = 0.08\text{m}$), Foot sole flat on ground ($Y = 0.00\text{m}$). |

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
       new Vector3(side * 0.32, 0.50, 0.07), // Curved elbow
       new Vector3(side * 0.42, 0.35, 0.13), // Wrist
     ];
     MeshBuilder.CreateTube("arm", {
       path: armPath,
       radiusFunction: (i) => i === 0 ? 0.07 : (i === 1 ? 0.055 : 0.045),
       tessellation: 16,
       cap: Mesh.CAP_ALL
     }, scene);
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

| Character Element | PBR Albedo Color | Roughness | Metallic | Notes |
|---|---|---|---|---|
| **Stylized Demon Skin** | `#c9182b` (Crimson Red) | 0.38 | 0.02 | Soft satin sheen showcasing curvaceous organic contours |
| **Horns & Halo** | `#202024` (Charcoal) | 0.45 | 0.10 | Matte horn texture / dark metallic ring |
| **Eyes (Sclera)** | `#f0f0f5` (White) | 0.25 | 0.00 | Glossy cartoon eyeball |
| **Pupils** | `#111114` (Jet Black) | 0.50 | 0.00 | Horizontal slit cartoon pupils |
| **Fangs / Teeth** | `#ffffff` (Pure White) | 0.30 | 0.00 | Smooth enamel fangs |
| **Human / Chibi Skin** | `#f5c59e` or `#f8c8a0` | 0.50 | 0.00 | Warm cartoon peach skin tone |
| **Mario Red Cap** | `#e52521` | 0.45 | 0.00 | Iconic Nintendo vermilion red |
| **Swimming Trunks** | `#002fbe` (Royal Blue) | 0.45 | 0.05 | Blue swim shorts with `#ffffff` waistband |
| **Cartoon Gloves** | `#f5f5f5` | 0.40 | 0.00 | Soft white fabric with rolled wrist cuffs |
| **Boots / Shoes** | `#5c2c16` | 0.70 | 0.00 | Deep leather brown |

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

## 7. Recipe: Super Mario in Swimming Trunks (Soft Organic Chibi)

When building Super Mario in swimming trunks (T-Pose):

1. **Step 1: Spawn Chibi Base Mesh in T-Pose**:
   - Call `modeler_spawn_base_mesh`:
     ```json
     { "type": "chibi", "pose": "t_pose", "name": "mario_base", "materialStyle": "colored", "style": "organic" }
     ```
   - Setting `"style": "organic"` ensures limbs are generated as smooth continuous tubes without disjoint sphere joints!

2. **Step 2: Add Iconic Mario Features via Babylon Code (`modeler_execute_babylon_code`)**:
   - **Red Cap**:
     - Crown: Flattened red hemisphere/ovoid placed on the upper head ($Y = 1.15\text{m}$, diameter $0.44\text{m}$, scaling $Y = 0.65$).
     - Visor Brim: Curved red visor shelf extending forward above the brow ($Y = 1.05\text{m}, Z = 0.22\text{m}$, width $0.32\text{m}$, depth $0.14\text{m}$, tilted slightly down $10^\circ$).
     - White Badge: Circular white disc on the front of the cap ($Y = 1.14\text{m}, Z = 0.21\text{m}$, diameter $0.09\text{m}$).
   - **Face & Mustache**:
     - Mustache: Arching black mustache curving beneath the nose ($Y = 0.90\text{m}, Z = 0.22\text{m}$), built with 4 to 6 overlapping rounded capsules/spheres flared outward on each side.
     - Eyes: Two oval blue cartoon eyes ($Y = 1.02\text{m}, Z = 0.20\text{m}, X = \pm 0.07\text{m}$) with white outer sclera.
   - **Swim Trunks Details**:
     - Raised white waistband torus/cylinder ($Y = 0.58\text{m}$, diameter $0.45\text{m}$, height $0.04\text{m}$).
     - White vertical side stripes down the outer hips ($X = \pm 0.22\text{m}$).
     - Yellow drawstring knot in the front center ($Y = 0.58\text{m}, Z = 0.22\text{m}$).
   - **Hands & Boots Alignment**:
     - Ensure gloves sit exactly at the T-Pose wrist joints ($X = \pm 0.64\text{m}, Y = 0.74\text{m}$).
     - Ensure brown boots are attached at feet coordinates ($X = \pm 0.13\text{m}, Y = 0.07\text{m}$).
3. **Step 3: Retopologize to Target Budget**:
   - Call `modeler_retopologize_mesh` with `targetFaces: 4000` (for mobile) or `15000` (for standard game).
   - This cleans and simplifies the mesh geometry into a game-ready model while recalculating smooth normals.

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

## 4. Game-Ready Retopology & Deformation Edge Loops (Hippydrome Rules)

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
   - Concentric circular loop masks around eyes (*orbicularis oculi*) for blinking.
   - Concentric loop rings around mouth (*orbicularis oris*) for speech phonemes.
   - Nasolabial fold loop running from nostril wings down past the mouth corners.
4. **Poles & Valence Management**:
   - **5-Poles (E-poles)** and **3-Poles (N-poles)** must be kept away from dynamic deformation zones (armpits, knee hollows, eyelid folds).
   - Route poles to rigid, static surface regions (e.g. temple, outer thigh, shoulder plate).

---

## 8. Tool Pipeline in Mesh Editor

When building or updating figures, combine these built-in tools:

1. **Step 1: Spawn Base Mesh Blockout**:
   - Call `modeler_spawn_base_mesh`:
     - `type: "chibi"` (or `canon: "chibi"`): Spawns the 3.5-head cartoon blockout in T-Pose with pre-assigned PBR materials for skin, clothing, gloves, and boots (ideal for Mario, dwarves, toons).
     - `type: "humanoid"`: Spawns the 1.80m Loomis mannequin with built-in knee, elbow, and hip joint rings. Set `pose: "t_pose"` for outstretched arms.
     - `type: "quadruped"`: Spawns animal base with digitigrade leg mechanics and angled scapula.
     - `type: "head_bust"`: Spawns head with facial planes, eye cavities, and neck.
     - `type: "sculpt_sphere"`: Spawns high-density clay sphere for freeform sculpting.
2. **Step 2: Box-Modeling & Proportional Edits**:
   - Use `modeler_facet_extrude` to pull out horns, armor plates, tails, or wings.
   - Use `modeler_facet_inset` to recess eye sockets or wound portals.
   - Call `modeler_subd_smooth` with `iterations: 1` or `2` to relax blockout polygons into smooth organic curvature.
3. **Step 3: Game-Ready Retopology & Optimization**:
   - Call `modeler_retopologize_mesh` with `targetFaces`:
     - `targetFaces: 4000` for mobile/WebGL models.
     - `targetFaces: 15000` for standard third-person game characters.
     - `targetFaces: 32000` for high-fidelity hero assets.
   - This applies Quadric Error Metric simplification, preserves silhouettes, and recalculates smooth vertex normals.
4. **Step 4: PBR Material & Normal Maps**:
   - Call `modeler_create_material` with PBR skin/clay parameters:
     - Skin / Clay: `albedoColor: "#d9b38c"`, `roughness: 0.65`, `metallic: 0.0`.
     - Normal maps: Use `normalMapUrl` or procedural surface relief with `bumpLevel: 1.2` to retain fine wrinkles and skin pores without polygon overhead.

