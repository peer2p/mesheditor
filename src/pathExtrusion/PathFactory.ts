import { Curve3, Mesh, Scene, Vector3, VertexData } from '@babylonjs/core';
import { PresetShapeName, ShapeConfig, SolidShape } from './types';

export class PathFactory {
  /**
   * Generates a 2D cross-section shape in the XY plane (z = 0) based on configuration.
   */
  public static getShapePoints(config: ShapeConfig): SolidShape {
    const shapeType = (config.shapeType || 'pipe') as PresetShapeName;
    const width = config.width ?? 1.5;
    const height = config.height ?? 0.5;
    const depth = config.depth ?? 0.5;
    const radius = config.radius ?? 1.0;
    const thickness = config.thickness ?? 0;
    const segments = config.segments ?? 16;
    const excludeBottom = config.excludeBottom ?? 0;
    const starPoints = config.starPoints ?? 5;
    const outerRadius = config.outerRadius ?? (config.radius ?? 1.5);
    const innerRadius = config.innerRadius ?? outerRadius * 0.45;

    switch (shapeType) {
      case 'pipe':
        return this.shapePipe(segments, radius, thickness, excludeBottom);
      case 'flatPipe':
        return this.shapeFlatPipe(segments, width, height, thickness);
      case 'circle':
        return this.shapeCircle(segments, radius, thickness);
      case 'rectangle':
        return this.shapeRectangle(width, height, thickness);
      case 'uProfile':
      case 'uprofile':
        return this.shapeUProfile(width, height, thickness > 0 ? thickness : 0.25);
      case 'halfpipe':
        return this.shapeHalfpipe(width, height, depth, thickness > 0 ? thickness : 0.1);
      case 'triangle':
        return this.shapeTriangle(width, height, thickness);
      case 'ellipse':
        return this.shapeEllipse(segments, width, height, thickness);
      case 'star':
        return this.shapeStar(starPoints, outerRadius, innerRadius);
      case 'horizontalLine':
        return this.shapeHorizontalLine(width, segments);
      case 'verticalLine':
        return this.shapeVerticalLine(height, segments);
      case 'halfCircle':
        return this.shapeHalfCircle(segments, radius);
      case 'halfCircleDepth':
        return this.shapeHalfCircleDepth(segments, radius);
      case 'depthLine':
        return this.shapeDepthLine(segments, depth);
      case 'diagonalUp':
        return this.shapeDiagonalUp(segments, width, height);
      case 'diagonalDown':
        return this.shapeDiagonalDown(segments, width, height);
      case 'plane':
        return this.shapePlane(segments, width, height);
      case 'flat':
      default:
        return this.shapeFlat(width, thickness > 0 ? thickness : 0.08);
    }
  }

  /**
   * Rectangle box profile.
   */
  public static shapeRectangle(width = 1, height = 0.25, thickness = 0): SolidShape {
    const points: SolidShape = [
      new Vector3(-width, 0, 0),
      new Vector3(width, 0, 0),
      new Vector3(width, -height, 0),
      new Vector3(-width, -height, 0),
    ];
    if (thickness > 0) {
      const iw = width - thickness;
      const ih = height - thickness;
      // Inner rectangle (reversed winding)
      points.push(
        new Vector3(-iw, -thickness, 0),
        new Vector3(iw, -thickness, 0),
        new Vector3(iw, -(thickness + ih), 0),
        new Vector3(-iw, -(thickness + ih), 0)
      );
      // Reverse inner ring for correct winding
      const inner = points.splice(4, 4).reverse();
      points.push(...inner);
      points.solidHalfCount = 4;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates a U-Profile shape (channel/gutter)
   */
  public static shapeUProfile(width = 1, height = 0.5, thickness = 0.25): SolidShape {
    const innerWidth = width - thickness;
    const points: SolidShape = [
      // outer side (clockwise)
      new Vector3(-width, height, 0),
      new Vector3(-width, 0, 0),
      new Vector3(width, 0, 0),
      new Vector3(width, height, 0),
      // inner side (counter-clockwise)
      new Vector3(innerWidth, height, 0),
      new Vector3(innerWidth, thickness, 0),
      new Vector3(-innerWidth, thickness, 0),
      new Vector3(-innerWidth, height, 0),
    ];
    points.solidHalfCount = 4;
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a triangle shape
   */
  public static shapeTriangle(width = 1, height = 1, thickness = 0): SolidShape {
    const points: SolidShape = [
      new Vector3(0, height, 0),
      new Vector3(width, 0, 0),
      new Vector3(-width, 0, 0),
    ];
    if (thickness > 0) {
      const scale = Math.max(0.01, 1 - thickness / Math.min(width, height));
      points.push(
        new Vector3(0, height * scale + thickness * 0.5, 0),
        new Vector3(width * scale, thickness, 0),
        new Vector3(-width * scale, thickness, 0)
      );
      const inner = points.splice(3, 3).reverse();
      points.push(...inner);
      points.solidHalfCount = 3;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates a round pipe. When thickness is specified, creates a solid annular cross-section.
   */
  public static shapePipe(segments = 16, radius = 1, thickness = 0, excludeBottomPoints = 0): SolidShape {
    const points: SolidShape = [];

    const bottomCenter = Math.round((segments * 3) / 4);
    const excludeStart = bottomCenter - Math.floor(excludeBottomPoints / 2);
    const excludeSet = new Set<number>();
    for (let e = 0; e < excludeBottomPoints; e++) {
      excludeSet.add((((excludeStart + e) % segments) + segments) % segments);
    }

    // Outer ring
    let flatBottomY: number | null = null;
    let insertedFlat = false;
    for (let i = 0; i < segments; i++) {
      if (excludeSet.has(i)) {
        if (!insertedFlat && points.length > 0) {
          flatBottomY = points[points.length - 1].y;
          insertedFlat = true;
        }
        continue;
      }
      if (insertedFlat && flatBottomY !== null) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        points.push(new Vector3(x, flatBottomY, 0));
        insertedFlat = false;
      }
      const angle = (i / segments) * Math.PI * 2;
      points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }

    // Inner ring (if thickness specified)
    if (thickness > 0) {
      const innerRadius = Math.max(0.01, radius - thickness);
      const innerPoints: Vector3[] = [];
      let innerFlatBottomY: number | null = null;
      let innerInsertedFlat = false;

      for (let i = segments - 1; i >= 0; i--) {
        if (excludeSet.has(i)) {
          if (!innerInsertedFlat && innerPoints.length > 0) {
            innerFlatBottomY = innerPoints[innerPoints.length - 1].y;
            innerInsertedFlat = true;
          }
          continue;
        }
        if (innerInsertedFlat && innerFlatBottomY !== null) {
          const angle = (i / segments) * Math.PI * 2;
          const x = Math.cos(angle) * innerRadius;
          innerPoints.push(new Vector3(x, innerFlatBottomY, 0));
          innerInsertedFlat = false;
        }
        const angle = (i / segments) * Math.PI * 2;
        innerPoints.push(new Vector3(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius, 0));
      }

      points.push(...innerPoints);
      points.solidHalfCount = points.length - innerPoints.length;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates a flat oval pipe.
   */
  public static shapeFlatPipe(segments = 16, width = 1, height = 0.25, thickness = 0): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new Vector3(Math.cos(angle) * width, Math.sin(angle) * height, 0));
    }
    if (thickness > 0) {
      const iw = Math.max(0.01, width - thickness);
      const ih = Math.max(0.01, height - thickness);
      for (let i = segments - 1; i >= 0; i--) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new Vector3(Math.cos(angle) * iw, Math.sin(angle) * ih, 0));
      }
      points.solidHalfCount = segments;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates a circle disc shape.
   */
  public static shapeCircle(segments = 16, radius = 1, thickness = 0): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    if (thickness > 0) {
      const ir = Math.max(0.01, radius - thickness);
      for (let i = segments - 1; i >= 0; i--) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new Vector3(Math.cos(angle) * ir, Math.sin(angle) * ir, 0));
      }
      points.solidHalfCount = segments;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates an ellipse shape.
   */
  public static shapeEllipse(segments = 16, width = 1, height = 0.5, thickness = 0): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new Vector3(Math.cos(angle) * width, Math.sin(angle) * height, 0));
    }
    if (thickness > 0) {
      const iw = Math.max(0.01, width - thickness);
      const ih = Math.max(0.01, height - thickness);
      for (let i = segments - 1; i >= 0; i--) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new Vector3(Math.cos(angle) * iw, Math.sin(angle) * ih, 0));
      }
      points.solidHalfCount = segments;
      points.closedShape = true;
    }
    return points;
  }

  /**
   * Creates a horizontal line shape.
   */
  public static shapeHorizontalLine(width = 2, segments = 5): SolidShape {
    const points: SolidShape = [];
    const halfWidth = width / 2;
    for (let i = 0; i < segments; i++) {
      const t = segments > 1 ? i / (segments - 1) : 0.5;
      const x = -halfWidth + t * width;
      points.push(new Vector3(x, 0, 0));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a vertical line shape.
   */
  public static shapeVerticalLine(height = 2, segments = 5): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const t = segments > 1 ? i / (segments - 1) : 0;
      const y = t * height;
      points.push(new Vector3(0, y, 0));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a half circle (upper arc).
   */
  public static shapeHalfCircle(segments = 8, radius = 1): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a half circle along depth.
   */
  public static shapeHalfCircleDepth(segments = 8, radius = 1): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      const y = Math.sin(angle) * radius;
      const z = (1 - Math.cos(angle)) * radius;
      points.push(new Vector3(0, y, z));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a star shape.
   */
  public static shapeStar(points = 5, outerRadius = 1, innerRadius?: number): SolidShape {
    const result: SolidShape = [];
    const inner = innerRadius ?? outerRadius * 0.45;
    const totalPoints = points * 2;
    for (let i = 0; i < totalPoints; i++) {
      const angle = (i / totalPoints) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : inner;
      result.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    result.closedShape = true;
    return result;
  }

  /**
   * Creates a depth line shape along the Z-axis.
   */
  public static shapeDepthLine(segments = 5, depth = 2): SolidShape {
    const points: SolidShape = [];
    const halfDepth = depth / 2;
    for (let i = 0; i < segments; i++) {
      const t = segments > 1 ? i / (segments - 1) : 0.5;
      const z = -halfDepth + t * depth;
      points.push(new Vector3(0, 0, z));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a diagonal line going right and up.
   */
  public static shapeDiagonalUp(segments = 5, width = 2, height = 2): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const t = segments > 1 ? i / (segments - 1) : 0;
      points.push(new Vector3(t * width, t * height, 0));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a diagonal line going right and down.
   */
  public static shapeDiagonalDown(segments = 5, width = 2, height = 2): SolidShape {
    const points: SolidShape = [];
    for (let i = 0; i < segments; i++) {
      const t = segments > 1 ? i / (segments - 1) : 0;
      points.push(new Vector3(t * width, -t * height, 0));
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a plane grid of positions.
   */
  public static shapePlane(segments = 3, width = 2, height = 2): SolidShape {
    const points: SolidShape = [];
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    for (let row = 0; row < segments; row++) {
      const ty = segments > 1 ? row / (segments - 1) : 0.5;
      const y = -halfHeight + ty * height;
      for (let col = 0; col < segments; col++) {
        const tx = segments > 1 ? col / (segments - 1) : 0.5;
        const x = -halfWidth + tx * width;
        points.push(new Vector3(x, y, 0));
      }
    }
    points.closedShape = false;
    return points;
  }

  /**
   * Creates a halfpipe with thickness.
   */
  public static shapeHalfpipe(width = 1, height = 1 / 6, depth = 1 / 6, thickness = 0.5 / 6): SolidShape {
    const points: SolidShape = [
      new Vector3(-width, height, 0),
      new Vector3(-width, 0, 0),
      new Vector3(0, -depth, 0),
      new Vector3(width, 0, 0),
      new Vector3(width, height, 0),
      new Vector3(width - thickness, height, 0),
      new Vector3(width - thickness, thickness, 0),
      new Vector3(0, -depth + thickness, 0),
      new Vector3(-width + thickness, thickness, 0),
      new Vector3(-width + thickness, height, 0),
    ];
    points.solidHalfCount = 5;
    points.closedShape = false;
    return points;
  }

  /**
   * Flat road/track profile.
   */
  public static shapeFlat(width = 1.0, thickness = 0.08): SolidShape {
    const halfWidth = width / 2;
    const halfThick = thickness / 2;
    const points: SolidShape = [
      new Vector3(-halfWidth, halfThick, 0),
      new Vector3(halfWidth, halfThick, 0),
      new Vector3(halfWidth, -halfThick, 0),
      new Vector3(-halfWidth, -halfThick, 0),
    ];
    points.closedShape = true;
    return points;
  }

  /**
   * Scales a path uniformly.
   */
  public static scalePath(path: Vector3[], scale: number): Vector3[] {
    return path.map((p) => p.scale(scale));
  }

  /**
   * Computes a smooth 3D Catmull-Rom spline through control points.
   */
  public static computeSpline(points: Vector3[], smoothSteps = 10): Vector3[] {
    if (points.length < 2) {
      return points.map((p) => p.clone());
    }
    if (points.length === 2 || smoothSteps <= 1) {
      const p0 = points[0];
      const p1 = points[1];
      const result: Vector3[] = [];
      const steps = Math.max(2, smoothSteps);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        result.push(Vector3.Lerp(p0, p1, t));
      }
      return result;
    }

    const curve = Curve3.CreateCatmullRomSpline(points, smoothSteps, false);
    return curve.getPoints();
  }

  /**
   * Creates a smooth, zero-twist 3D path extrusion mesh with stable local coordinate frames,
   * manifold solid walls, UV seam duplication, rims, and end caps.
   *
   * Ported directly from platformia3d PathFactory.
   */
  public static createPathMeshWithShape(
    name: string,
    path: Vector3[],
    shape: Vector3[],
    scene: Scene,
    yOffset = 0,
    solidHalfCount = 0,
    capEnds = false,
    closedShapeParam = false
  ): Mesh {
    // 1. Deduplicate consecutive duplicate path points to prevent zero-tangent issues
    const cleanPath: Vector3[] = [];
    if (path.length > 0) {
      cleanPath.push(path[0].clone());
      for (let i = 1; i < path.length; i++) {
        if (Vector3.Distance(path[i], cleanPath[cleanPath.length - 1]) > 0.001) {
          cleanPath.push(path[i].clone());
        }
      }
    }
    path = cleanPath;

    if (path.length < 2 || shape.length < 2) {
      return new Mesh(name, scene);
    }

    const closedShape = (shape as SolidShape).closedShape ?? closedShapeParam;

    if (solidHalfCount === 0 && (shape as SolidShape).solidHalfCount) {
      solidHalfCount = (shape as SolidShape).solidHalfCount!;
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const numShapePoints = shape.length;

    // Calculate total path length for UV mapping
    let totalLength = 0;
    const segmentLengths: number[] = [0];
    for (let i = 1; i < path.length; i++) {
      totalLength += Vector3.Distance(path[i - 1], path[i]);
      segmentLengths.push(totalLength);
    }

    // Calculate UV offsets for each shape point along the perimeter
    const shapeUVs: number[] = [];
    let perimeterLength = 0;
    for (let j = 0; j < numShapePoints; j++) {
      shapeUVs.push(perimeterLength);
      const nextJ = (j + 1) % numShapePoints;
      perimeterLength += Vector3.Distance(shape[j], shape[nextJ]);
    }
    const safePerimeter = perimeterLength > 0.0001 ? perimeterLength : 1;
    for (let j = 0; j < numShapePoints; j++) {
      shapeUVs[j] /= safePerimeter;
    }

    // Generate vertices along the path
    for (let i = 0; i < path.length; i++) {
      const curr = path[i];
      const prev = path[i - 1] ?? path[i];
      const next = path[i + 1] ?? path[i];

      // Calculate forward tangent
      let tangent = next.subtract(prev);
      if (tangent.lengthSquared() < 0.00001) {
        tangent = new Vector3(0, 0, 1);
      } else {
        tangent.normalize();
      }

      // Calculate stable local coordinate system (prevents Frenet-Serret twisting)
      let up = Vector3.Up();
      if (Math.abs(Vector3.Dot(tangent, up)) > 0.99) {
        up = new Vector3(1, 0, 0);
      }

      const right = Vector3.Cross(up, tangent).normalize();
      const localUp = Vector3.Cross(tangent, right).normalize();

      const center = curr.add(Vector3.Up().scale(yOffset));

      for (let j = 0; j < numShapePoints; j++) {
        const shapePoint = shape[j];
        const worldPos = center.add(right.scale(shapePoint.x)).add(localUp.scale(shapePoint.y));
        positions.push(worldPos.x, worldPos.y, worldPos.z);

        const u = shapeUVs[j];
        const v = segmentLengths[i] * 0.2;
        uvs.push(u, v);
      }

      // Add UV seam vertices for closed solid rings
      if (solidHalfCount > 0) {
        const v = segmentLengths[i] * 0.2;
        const outerFirst = shape[0];
        const outerPos = center.add(right.scale(outerFirst.x)).add(localUp.scale(outerFirst.y));
        positions.push(outerPos.x, outerPos.y, outerPos.z);
        uvs.push(1.0, v);

        const innerFirst = shape[solidHalfCount];
        const innerPos = center.add(right.scale(innerFirst.x)).add(localUp.scale(innerFirst.y));
        positions.push(innerPos.x, innerPos.y, innerPos.z);
        uvs.push(1.0, v);
      }
    }

    // Build indices
    if (solidHalfCount > 0) {
      const N = solidHalfCount;
      const stride = numShapePoints + 2;
      for (let i = 0; i < path.length - 1; i++) {
        const baseIdx = i * stride;
        const nextBaseIdx = (i + 1) * stride;
        const loopCount = closedShape ? N : N - 1;

        // Outer ring
        for (let j = 0; j < loopCount; j++) {
          const nextJ = j + 1 < N ? j + 1 : numShapePoints;
          indices.push(baseIdx + j, baseIdx + nextJ, nextBaseIdx + j);
          indices.push(baseIdx + nextJ, nextBaseIdx + nextJ, nextBaseIdx + j);
        }

        // Inner ring
        for (let j = 0; j < loopCount; j++) {
          const currJ = N + j;
          const nextJ = j + 1 < N ? N + j + 1 : numShapePoints + 1;
          indices.push(baseIdx + currJ, baseIdx + nextJ, nextBaseIdx + currJ);
          indices.push(baseIdx + nextJ, nextBaseIdx + nextJ, nextBaseIdx + currJ);
        }

        // Side rims for open shapes (U-profile, halfpipe)
        if (!closedShape) {
          // Left rim
          const lO = baseIdx + 0;
          const lI = baseIdx + 2 * N - 1;
          const nlO = nextBaseIdx + 0;
          const nlI = nextBaseIdx + 2 * N - 1;
          indices.push(lO, nlO, lI);
          indices.push(nlO, nlI, lI);

          // Right rim
          const rO = baseIdx + N - 1;
          const rI = baseIdx + N;
          const nrO = nextBaseIdx + N - 1;
          const nrI = nextBaseIdx + N;
          indices.push(rO, rI, nrO);
          indices.push(nrO, rI, nrI);
        }
      }
    } else {
      const edgeCount = closedShape ? numShapePoints : numShapePoints - 1;
      for (let i = 0; i < path.length - 1; i++) {
        const baseIdx = i * numShapePoints;
        const nextBaseIdx = (i + 1) * numShapePoints;

        for (let j = 0; j < edgeCount; j++) {
          const nextJ = (j + 1) % numShapePoints;
          const idx0 = baseIdx + j;
          const idx1 = baseIdx + nextJ;
          const idx2 = nextBaseIdx + j;
          const idx3 = nextBaseIdx + nextJ;

          indices.push(idx0, idx2, idx1);
          indices.push(idx1, idx2, idx3);
        }
      }
    }

    // End caps
    if (solidHalfCount > 0 && path.length >= 2 && capEnds) {
      const N = solidHalfCount;
      const capStride = numShapePoints + 2;
      const startBase = 0;
      const loopCount = closedShape ? N : N - 1;

      for (let j = 0; j < loopCount; j++) {
        const outerCurr = startBase + j;
        const outerNext = startBase + ((j + 1) % N);
        const innerCurr = startBase + N + (N - 1 - j);
        const innerNext = startBase + N + (N - 1 - ((j + 1) % N));

        indices.push(outerCurr, innerCurr, outerNext);
        indices.push(outerNext, innerCurr, innerNext);
      }

      const endBase = (path.length - 1) * capStride;
      for (let j = 0; j < loopCount; j++) {
        const outerCurr = endBase + j;
        const outerNext = endBase + ((j + 1) % N);
        const innerCurr = endBase + N + (N - 1 - j);
        const innerNext = endBase + N + (N - 1 - ((j + 1) % N));

        indices.push(outerCurr, outerNext, innerCurr);
        indices.push(outerNext, innerNext, innerCurr);
      }
    } else if (capEnds && solidHalfCount === 0 && path.length >= 2 && closedShape && numShapePoints >= 3) {
      const startBase = 0;
      for (let j = 1; j < numShapePoints - 1; j++) {
        indices.push(startBase, startBase + j + 1, startBase + j);
      }
      const endBase = (path.length - 1) * numShapePoints;
      for (let j = 1; j < numShapePoints - 1; j++) {
        indices.push(endBase, endBase + j, endBase + j + 1);
      }
    }

    const mesh = new Mesh(name, scene);
    const vData = new VertexData();
    vData.positions = positions;
    vData.indices = indices;
    vData.uvs = uvs;
    vData.applyToMesh(mesh);

    if (solidHalfCount > 0 || capEnds) {
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.setVerticesData('normal', normals);
    } else {
      mesh.convertToFlatShadedMesh();
    }

    return mesh;
  }
}
