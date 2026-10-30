import {
  Color3,
  Color4,
  CSG,
  CSG2,
  DynamicTexture,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  PBRMaterial,
  Quaternion,
  StandardMaterial,
  Texture,
  Vector3,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import earcut from 'earcut';
import { AbstractTool } from '../AbstractTool';
import { ToolExecutionContext } from '../ToolExecutionContext';

export class ExecuteBabylonCodeTool extends AbstractTool {
  public readonly name = 'modeler_execute_babylon_code';
  public readonly description =
    'Executes custom procedural Babylon.js JavaScript code directly against the live scene. Ideal for complex parametric models with loops, math curves, CSG2 chains, or custom VertexData.';

  public readonly parameters = {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Short summary of what this script builds or updates.' },
      code: {
        type: 'string',
        description:
          'JavaScript function body (supports async/await). Available variables in scope: scene, service, MeshBuilder, Mesh, Vector3, Color3, Color4, Quaternion, Matrix, PBRMaterial, StandardMaterial, MultiMaterial, Texture, DynamicTexture, VertexData, VertexBuffer, CSG, CSG2, earcut, registerMesh(mesh), createMaterial(name, hexColor, roughness, metallic), autoUV(mesh, scale), booleanOp(baseMesh, toolMesh, op, newName, keepTool). Return a summary string or created mesh(es).',
      },
    },
    required: ['code'],
  };

  public async execute(args: any, context: ToolExecutionContext): Promise<string> {
    const code = String(args.code || '');
    if (!code.trim()) {
      throw new Error('Empty code passed to modeler_execute_babylon_code.');
    }

    const meshesBefore = new Set(context.service.scene.meshes);
    const explicitlyRegistered: Mesh[] = [];

    const registerMesh = (m: Mesh) => {
      if (m && m instanceof Mesh && !m.isDisposed()) {
        context.registerCreatedMesh(m);
        explicitlyRegistered.push(m);
      }
      return m;
    };

    const createMaterial = (
      name: string,
      hexColor: string = '#58a6ff',
      roughness: number = 0.45,
      metallic: number = 0.1,
      emissiveHex?: string
    ) => {
      const mat = context.getOrCreateMaterial(name, hexColor, roughness, metallic);
      if (emissiveHex) {
        mat.emissiveColor = Color3.FromHexString(this.normalizeHex(emissiveHex));
      }
      return mat;
    };

    const autoUV = (m: Mesh, scale: number = 1.0) => {
      if (m && m instanceof Mesh && !m.isDisposed()) {
        const prev = context.service.selectedMesh;
        context.service.selectedMesh = m;
        context.service.applyTriplanarUVs(scale);
        context.service.selectedMesh = prev;
      }
      return m;
    };

    const booleanOp = async (
      baseMesh: Mesh,
      toolMesh: Mesh,
      op: 'union' | 'subtract' | 'intersect' = 'subtract',
      newName?: string,
      keepTool: boolean = false
    ) => {
      const res = await context.service.performCSGOperation(baseMesh, toolMesh, op, keepTool);
      if (res && newName) res.name = newName;
      return res;
    };

    const BABYLON_NS = {
      MeshBuilder,
      Mesh,
      Vector3,
      Color3,
      Color4,
      Quaternion,
      Matrix,
      PBRMaterial,
      StandardMaterial,
      MultiMaterial,
      Texture,
      DynamicTexture,
      VertexData,
      VertexBuffer,
      CSG,
      CSG2,
    };

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction(
      'scene',
      'service',
      'BABYLON',
      'MeshBuilder',
      'Mesh',
      'Vector3',
      'Color3',
      'Color4',
      'Quaternion',
      'Matrix',
      'PBRMaterial',
      'StandardMaterial',
      'MultiMaterial',
      'Texture',
      'DynamicTexture',
      'VertexData',
      'VertexBuffer',
      'CSG',
      'CSG2',
      'earcut',
      'registerMesh',
      'createMaterial',
      'createPBRMaterial',
      'autoUV',
      'booleanOp',
      code
    );

    const returnVal = await fn(
      context.scene,
      context.service,
      BABYLON_NS,
      MeshBuilder,
      Mesh,
      Vector3,
      Color3,
      Color4,
      Quaternion,
      Matrix,
      PBRMaterial,
      StandardMaterial,
      MultiMaterial,
      Texture,
      DynamicTexture,
      VertexData,
      VertexBuffer,
      CSG,
      CSG2,
      earcut,
      registerMesh,
      createMaterial,
      createMaterial,
      autoUV,
      booleanOp
    );

    // Automatically register any new non-disposed meshes added to the scene during script execution
    const newlyAdded: string[] = [];
    for (const m of context.service.scene.meshes) {
      if (
        !meshesBefore.has(m) &&
        m instanceof Mesh &&
        !m.isDisposed() &&
        !context.service.isEditorHelper(m) &&
        m.getTotalVertices() > 0
      ) {
        context.registerCreatedMesh(m);
        newlyAdded.push(m.name);
      }
    }

    // Remove any disposed meshes from importedMeshes
    context.service.importedMeshes = context.service.importedMeshes.filter((m) => !m.isDisposed());

    return JSON.stringify({
      status: 'ok',
      createdMeshes: Array.from(new Set([...explicitlyRegistered.map((m) => m.name), ...newlyAdded])),
      result: returnVal !== undefined ? returnVal : undefined,
    });
  }
}

