import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { Scene } from "@babylonjs/core/scene";

export default class LocationManager {
  constructor(private scene: Scene) {}
  public async createBaseArea() {
    const meshes = await SceneLoader.ImportMeshAsync(
      "",
      "../assets/maps/",
      "uploads_files_4359726_city+2.glb"
    );
    var skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this.scene);
    var skyboxMaterial = new StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture(
      "../assets/textures/TropicalSunnyDay",
      this.scene
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;
    const root = meshes.meshes[0];
    root.scaling = new Vector3(9, 9, 9);
    const ground = MeshBuilder.CreateBox("ground", {
      height: 1,
      width: 800,
      depth: 800,
    });
    ground.position.y = 29;

    ground.setEnabled(false);
    const groundShape = new PhysicsShapeBox(
      Vector3.Zero(),
      ground.rotationQuaternion,
      new Vector3(800, 1, 800),
      this.scene
    );
    const groundBody = new PhysicsBody(
      ground,
      PhysicsMotionType.STATIC,
      false,
      this.scene
    );
    groundShape.material = {};
    groundBody.shape = groundShape;
    groundBody.setMassProperties({ mass: 0 });
  }
}
