import * as THREE from "three";
import type { FootballAction, FootSide } from "./footballActions";
import { smooth } from "./footballActions";
import type { FootballReaction } from "./reactions";
import type { DummyAction } from "./dummy";
import { actionWindows } from "./footballActions";
import type { Vec3 } from "../types";

const up = new THREE.Vector3(0, 1, 0);
const clamp = (x: number, low: number, high: number) =>
  Math.max(low, Math.min(high, x));
type Key = readonly [number, Vec3];
const shotProfiles = {
  standard: {
    windup: 0.24,
    rotation: 0.48,
    lean: 0.28,
    backswingHeight: 0.42,
    backswingZ: -0.43,
    followHeight: 0.51,
    followZ: 0.32,
  },
  driven: {
    windup: 0.31,
    rotation: 0.62,
    lean: 0.34,
    backswingHeight: 0.49,
    backswingZ: -0.49,
    followHeight: 0.62,
    followZ: 0.4,
  },
} as const;
/**
 * Interpolate cosmetic action targets with smooth easing inside the character-local pose frame.
 */
function trajectory(keys: Key[], time: number): THREE.Vector3 {
  const i = keys.findIndex((key) => key[0] > time);
  if (i < 1)
    return new THREE.Vector3(...keys[i === 0 ? 0 : keys.length - 1][1]);
  const a = keys[i - 1],
    b = keys[i];
  return new THREE.Vector3(...a[1]).lerp(
    new THREE.Vector3(...b[1]),
    smooth(a[0], b[0], time),
  );
}

/** Asset-specific action layer, not a general retargeter. Targets are in the
 * character's metre-scale X/Y/Z frame; only bones are changed, never scene/root.
 * Small analytic leg placement is needed: angular kicks alone leave the ball
 * 0.65m in front of the recorded root beyond the extended instep's reach.
 *
 * @param scene - One cloned character rig with the required asset-specific bone names.
 * @returns A bone-only pose applicator layered over locomotion; callers restore base poses before evaluation.
 */
export function createFootballPose(scene: THREE.Object3D) {
  const names = [
    "pelvis",
    "spine_01",
    "spine_02",
    "spine_03",
    "neck_01",
    ...["l", "r"].flatMap((side) =>
      ["thigh", "calf", "foot", "ball", "upperarm", "lowerarm"].map(
        (name) => `${name}_${side}`,
      ),
    ),
  ];
  const bones = Object.fromEntries(
    names.map((name) => [name, scene.getObjectByName(name)!]),
  );
  const bind = Object.fromEntries(
    names.map((name) => [
      name,
      { q: bones[name].quaternion.clone(), p: bones[name].position.clone() },
    ]),
  );
  // Evaluate matrices in an isolated character frame. getWorldPosition / world
  // quaternion helpers would climb the replay parent, making this pose depend
  // on its preceding rendered world transform and matrix decomposition rounding.
  // The renderer rebuilds ordinary world matrices after frame callbacks.
  function updateLocalMatrices() {
    scene.updateMatrix();
    scene.matrixWorld.copy(scene.matrix);
    scene.children.forEach((child) => child.updateMatrixWorld(true));
  }
  const matrixPosition = new THREE.Vector3(),
    matrixScale = new THREE.Vector3();
  function orientation(object: THREE.Object3D) {
    const q = new THREE.Quaternion();
    object.matrixWorld.decompose(matrixPosition, q, matrixScale);
    return q;
  }
  updateLocalMatrices();
  const sceneInverse = scene.matrixWorld.clone().invert();
  const frameQ = orientation(scene),
    inverseFrameQ = frameQ.clone().invert();
  const footQ = Object.fromEntries(
    ["l", "r"].map((side) => [
      side,
      orientation(bones[`foot_${side}`]).premultiply(inverseFrameQ),
    ]),
  );
  const raw = names.map((name) => ({
    bone: bones[name],
    q: new THREE.Quaternion(),
    p: new THREE.Vector3(),
  }));
  const position = (bone: THREE.Object3D) =>
    new THREE.Vector3()
      .setFromMatrixPosition(bone.matrixWorld)
      .applyMatrix4(sceneInverse);
  function setOrientation(bone: THREE.Object3D, q: THREE.Quaternion) {
    const parentQ = orientation(bone.parent!).invert();
    bone.quaternion.copy(parentQ.multiply(frameQ).multiply(q));
    bone.updateMatrixWorld(true);
  }
  function aim(
    bone: THREE.Object3D,
    child: THREE.Object3D,
    direction: THREE.Vector3,
  ) {
    const q = orientation(bone).premultiply(inverseFrameQ);
    const current = child.position.clone().normalize().applyQuaternion(q);
    setOrientation(
      bone,
      new THREE.Quaternion()
        .setFromUnitVectors(current, direction.normalize())
        .multiply(q),
    );
  }
  /** Solve this asset's two-link leg toward a character-local target; only bones move. */
  function leg(
    side: FootSide,
    target: THREE.Vector3,
    yaw: number,
    pitch: number,
  ) {
    const thigh = bones[`thigh_${side}`],
      calf = bones[`calf_${side}`],
      foot = bones[`foot_${side}`];
    const hip = position(thigh),
      l1 = calf.position.length(),
      l2 = foot.position.length();
    const direction = target.clone().sub(hip),
      d = clamp(direction.length(), 0.35, l1 + l2 - 0.006);
    direction.normalize();
    // The cosine-law projection locates the knee along hip-to-target. The
    // orthogonal pole selects the bend plane; reach clamping avoids a locked leg.
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const pole = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const knee = hip
      .clone()
      .addScaledVector(direction, along)
      .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    const ankle = hip.clone().addScaledVector(direction, d);
    aim(thigh, calf, knee.clone().sub(hip));
    aim(calf, foot, ankle.sub(knee));
    setOrientation(
      foot,
      new THREE.Quaternion()
        .setFromAxisAngle(up, yaw)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            pitch,
          ),
        )
        .multiply(footQ[side]),
    );
  }

  // Local boot probes use dominant skin joints, measured from this exact bind
  // mesh. Their small conservative correction removes ordinary sole penetration
  // without pinning airborne feet or shifting the recorded player root.
  const probes: { bone: THREE.Object3D; point: THREE.Vector3 }[] = [];
  const actionSoles: { mesh: THREE.SkinnedMesh; index: number }[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return;
    const attr = object.geometry.attributes;
    for (let i = 0; i < attr.position.count; i++) {
      if (attr.position.getY(i) > 0.115) continue;
      actionSoles.push({ mesh: object, index: i });
      let slot = 0;
      for (let k = 1; k < 4; k++)
        if (
          attr.skinWeight.getComponent(i, k) >
          attr.skinWeight.getComponent(i, slot)
        )
          slot = k;
      const bone = object.skeleton.bones[attr.skinIndex.getComponent(i, slot)];
      if (!/^(foot|ball)_[lr]$/.test(bone.name)) continue;
      const point = new THREE.Vector3()
        .fromBufferAttribute(attr.position, i)
        .applyMatrix4(object.matrixWorld)
        .applyMatrix4(bone.matrixWorld.clone().invert());
      probes.push({ bone, point });
    }
  });
  const point = new THREE.Vector3();
  return {
    /** Layer action/reaction/dummy bones over the sampled base pose without changing ball or roots. */
    apply(
      action: FootballAction | null,
      reaction: FootballReaction | null = null,
      dummy: DummyAction | null = null,
    ) {
      // Local pose math must never consume the replay parent's matrices.
      updateLocalMatrices();
      sceneInverse.copy(scene.matrixWorld).invert();
      frameQ.copy(orientation(scene));
      inverseFrameQ.copy(frameQ).invert();
      if (action) {
        raw.forEach((p) => {
          p.q.copy(p.bone.quaternion);
          p.p.copy(p.bone.position);
        });
        names.forEach((name) => {
          bones[name].quaternion.copy(bind[name].q);
          bones[name].position.copy(bind[name].p);
        });
        const shot = action.kind === "shot",
          receive = action.kind === "receive",
          driven = action.technique === "driven";
        const profile = driven ? shotProfiles.driven : shotProfiles.standard;
        // Compress the presentation trajectory to its available interval. The
        // canonical contact time/ball never moves; the foot still reaches e=0.
        const [prepare, recover] = actionWindows[action.kind];
        const e =
          action.elapsed < 0
            ? (action.elapsed * prepare) / (action.contact - action.start)
            : (action.elapsed * recover) / (action.end - action.contact);
        const side = action.foot,
          sign = side === "l" ? 1 : -1,
          support = side === "l" ? "r" : "l";
        const yaw = clamp(action.direction, -0.45, 0.45);
        const swing = smooth(shot ? -0.3 : -0.2, 0.2, e);
        const twist = shot
          ? profile.windup - swing * profile.rotation
          : 0.1 - swing * 0.2;
        // Pelvis local Z is world up under the asset's fixed root correction.
        bones.pelvis.position.z -= shot ? 0.12 : receive ? 0.14 : 0.1;
        bones.pelvis.quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, 1),
            twist,
          ),
        );
        bones.spine_01.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              shot ? profile.lean : 0.2,
              -twist * 0.7,
              -sign * 0.035,
            ),
          ),
        );
        bones.neck_01.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            0.16,
          ),
        );
        updateLocalMatrices();
        const direction = new THREE.Vector3(
          Math.sin(action.direction),
          0,
          Math.cos(action.direction),
        );
        const radial = new THREE.Vector3(
          action.ballLocal[0],
          0,
          action.ballLocal[2],
        ).normalize();
        const footYaw = receive ? yaw + sign * 0.45 : action.direction;
        const bootDirection = new THREE.Vector3(
          Math.sin(footYaw),
          0,
          Math.cos(footYaw),
        );
        const contact = new THREE.Vector3(...action.ballLocal).addScaledVector(
          bootDirection,
          receive ? -0.36 : shot ? -0.35 : -0.34,
        );
        contact.y = receive ? 0.14 : 0.1;
        const rest: Vec3 = [sign * 0.14, 0.09, -0.04];
        const keys: Key[] = receive
          ? [
              [-0.4, rest],
              [-0.14, [contact.x, 0.2, contact.z + 0.06]],
              [0, contact.toArray() as Vec3],
              [
                0.18,
                [
                  contact.x - radial.x * 0.13,
                  0.12,
                  contact.z - radial.z * 0.13,
                ],
              ],
              [0.65, rest],
            ]
          : [
              [shot ? -0.8 : -0.55, rest],
              [
                shot ? -0.28 : -0.19,
                [
                  sign * 0.18,
                  shot ? profile.backswingHeight : 0.17,
                  shot ? profile.backswingZ : -0.23,
                ],
              ],
              [0, contact.toArray() as Vec3],
              [
                shot ? 0.2 : 0.16,
                [
                  contact.x + direction.x * 0.2,
                  shot ? profile.followHeight : 0.22,
                  contact.z + direction.z * (shot ? profile.followZ : 0.17),
                ],
              ],
              ...(driven ? [[0.52, [sign * 0.15, 0.19, 0.16]] as Key] : []),
              [shot ? 0.95 : 0.7, rest],
            ];
        leg(support, new THREE.Vector3(...action.supportLocal), yaw * 0.5, 0);
        leg(
          side,
          trajectory(keys, e),
          footYaw,
          shot ? -0.12 * smooth(-0.15, 0.12, e) : 0,
        );
        for (const armSide of ["l", "r"]) {
          const armSign = armSide === "l" ? 1 : -1,
            opposite = armSign * sign;
          aim(
            bones[`upperarm_${armSide}`],
            bones[`lowerarm_${armSide}`],
            new THREE.Vector3(
              armSign * (shot ? 0.75 : 0.3),
              shot ? -0.5 : -0.65,
              (swing - 0.5) * opposite * (shot ? 0.7 : 0.3),
            ),
          );
          aim(
            bones[`lowerarm_${armSide}`],
            bones[`hand_${armSide}`] ??
              scene.getObjectByName(`hand_${armSide}`)!,
            new THREE.Vector3(armSign * 0.1, -0.7, 0.45),
          );
        }
        raw.forEach((p) => {
          p.bone.quaternion.slerp(p.q, 1 - action.weight);
          p.bone.position.lerp(p.p, 1 - action.weight);
        });
        updateLocalMatrices();
      }
      if (dummy) {
        raw.forEach((p) => {
          p.q.copy(p.bone.quaternion);
          p.p.copy(p.bone.position);
        });
        names.forEach((name) => {
          bones[name].quaternion.copy(bind[name].q);
          bones[name].position.copy(bind[name].p);
        });
        // An athletic 0.72 m ankle stance, lowered hips and forward knee poles.
        // The ball passes along local Z; neither leg is aimed at the ball.
        bones.pelvis.position.z -= 0.16;
        bones.pelvis.position.x += 0.025 * (1 - dummy.anticipation);
        bones.spine_01.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.12, 0.05 * (1 - dummy.anticipation), -0.025),
          ),
        );
        bones.neck_01.quaternion.multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.17, 0, 0)),
        );
        updateLocalMatrices();
        leg("l", new THREE.Vector3(0.36, 0.09, 0.015), 0.12, 0);
        leg("r", new THREE.Vector3(-0.36, 0.09, -0.015), -0.12, 0);
        for (const side of ["l", "r"]) {
          const sign = side === "l" ? 1 : -1;
          aim(
            bones[`upperarm_${side}`],
            bones[`lowerarm_${side}`],
            new THREE.Vector3(sign * 0.38, -0.7, 0.15),
          );
          aim(
            bones[`lowerarm_${side}`],
            scene.getObjectByName(`hand_${side}`)!,
            new THREE.Vector3(sign * 0.12, -0.5, 0.42),
          );
        }
        raw.forEach((p) => {
          p.bone.quaternion.slerp(p.q, 1 - dummy.weight);
          p.bone.position.lerp(p.p, 1 - dummy.weight);
        });
        updateLocalMatrices();
      }
      if (reaction && (!action || action.weight < 0.01) && !dummy) {
        const { kind, weight, elapsed: e, side, look } = reaction;
        raw.forEach((p) => {
          p.q.copy(p.bone.quaternion);
          p.p.copy(p.bone.position);
        });
        const arm = (
          armSide: string,
          upper: THREE.Vector3,
          lower: THREE.Vector3,
        ) => {
          aim(
            bones[`upperarm_${armSide}`],
            bones[`lowerarm_${armSide}`],
            upper,
          );
          aim(
            bones[`lowerarm_${armSide}`],
            scene.getObjectByName(`hand_${armSide}`)!,
            lower,
          );
        };
        if (kind === "keeper-dive" || kind === "keeper-track") {
          // Replace sideways walking with a planted ready stance and an event-
          // linked lateral lunge. The pelvis offset is cosmetic and bounded;
          // the player group and root bone always retain canonical transforms.
          names.forEach((name) => {
            bones[name].quaternion.copy(bind[name].q);
            bones[name].position.copy(bind[name].p);
          });
          updateLocalMatrices();
          const dive = kind === "keeper-dive";
          const tracking = reaction.trackingStride !== undefined;
          const reach =
            smooth(tracking ? 0.14 : 0.18, dive ? 0.76 : 0.55, e) *
            (1 -
              smooth(dive ? 1.0 : tracking ? 0.72 : 0.8, dive ? 2.1 : 1.65, e));
          const landing = dive
            ? smooth(0.65, 1.0, e) * (1 - smooth(1.1, 2.1, e))
            : 0;
          const lean = (dive ? 1.03 : tracking ? 0.26 : 0.18) * reach * side;
          const pelvisQ = orientation(bones.pelvis).premultiply(inverseFrameQ);
          setOrientation(
            bones.pelvis,
            new THREE.Quaternion()
              .setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean)
              .multiply(pelvisQ),
          );
          const center = position(bones.pelvis);
          center.x += side * reach * (dive ? 0.24 : 0.07);
          center.y -=
            (tracking ? 0.15 : 0.12) +
            (dive ? 0.36 * reach + 0.1 * landing : 0.03 * reach);
          const local = center
            .applyMatrix4(scene.matrixWorld)
            .applyMatrix4(bones.pelvis.parent!.matrixWorld.clone().invert());
          bones.pelvis.position.copy(local);
          updateLocalMatrices();
          const shuffle = tracking ? Math.sin(reaction.trackingStride!) : 0;
          leg(
            "l",
            new THREE.Vector3(
              0.19 + shuffle * 0.045,
              0.095 + Math.max(0, shuffle) * 0.045,
              -0.04,
            ),
            0,
            0,
          );
          leg(
            "r",
            new THREE.Vector3(
              -0.19 + shuffle * 0.045,
              0.095 + Math.max(0, -shuffle) * 0.045,
              -0.04,
            ),
            0,
            0,
          );
          for (const armSide of ["l", "r"]) {
            const sign = armSide === "l" ? 1 : -1;
            const spread =
              sign * 0.42 * (1 - reach) + side * (dive ? 0.95 : 0.6) * reach;
            const leading = sign === side;
            // One hand leads the reach; the trailing arm balances and then
            // braces downward as the torso settles, rather than both arms
            // remaining across the head during the landing.
            arm(
              armSide,
              new THREE.Vector3(
                spread * (leading ? 1 : 0.65),
                -0.28 + reach * 0.35 - landing * 0.35,
                0.32,
              ),
              new THREE.Vector3(
                side * reach * (leading ? 0.9 : 0.2),
                -0.12 - landing * (leading ? 0.3 : 0.45),
                leading ? 0.3 : 0.5,
              ),
            );
          }
        } else if (kind === "celebrate") {
          const lift = 0.9 + Math.sin(e * 3) * 0.055;
          for (const armSide of ["l", "r"]) {
            const sign = armSide === "l" ? 1 : -1;
            arm(
              armSide,
              new THREE.Vector3(sign * 0.5, lift, 0.12),
              new THREE.Vector3(sign * 0.12, 0.95, 0.12),
            );
          }
          bones.spine_01.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(-0.08, Math.sin(e * 1.8) * 0.1, 0),
            ),
          );
          bones.neck_01.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, 0)),
          );
        } else if (kind === "disappointed") {
          bones.neck_01.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0.08)),
          );
          for (const armSide of ["l", "r"]) {
            const sign = armSide === "l" ? 1 : -1;
            arm(
              armSide,
              new THREE.Vector3(sign * 0.3, -0.8, 0.1),
              new THREE.Vector3(sign * 0.1, -0.7, -0.1),
            );
          }
        } else {
          bones.spine_01.quaternion.multiply(
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0.09, look * 0.14, 0),
            ),
          );
          for (const armSide of ["l", "r"]) {
            const sign = armSide === "l" ? 1 : -1;
            arm(
              armSide,
              new THREE.Vector3(sign * 0.32, -0.72, 0.15),
              new THREE.Vector3(sign * 0.14, -0.55, 0.55),
            );
          }
        }
        const neckQ = orientation(bones.neck_01).premultiply(inverseFrameQ);
        setOrientation(
          bones.neck_01,
          new THREE.Quaternion()
            .setFromAxisAngle(up, look * 0.45)
            .multiply(neckQ),
        );
        raw.forEach((p) => {
          p.bone.quaternion.slerp(p.q, 1 - weight);
          p.bone.position.lerp(p.p, 1 - weight);
        });
        updateLocalMatrices();
      }
      let min = Infinity;
      for (const probe of probes)
        min = Math.min(
          min,
          point
            .copy(probe.point)
            .applyMatrix4(probe.bone.matrixWorld)
            .applyMatrix4(sceneInverse).y,
        );
      // Close actions rotate blended ankle/toe skin weights far enough that a
      // dominant-joint probe can miss a sole corner. Evaluate those few active
      // players' exact boot vertices; ordinary locomotion retains cheap probes.
      if (action || dummy) {
        let exact = Infinity;
        for (const probe of actionSoles)
          exact = Math.min(
            exact,
            probe.mesh
              .getVertexPosition(probe.index, point)
              .applyMatrix4(probe.mesh.matrixWorld)
              .applyMatrix4(sceneInverse).y,
          );
        // Enter the exact correction continuously, even at direct seeks just
        // either side of an action boundary where the underlying pose is idle.
        min +=
          (exact - min) *
          smooth(0, 0.05, Math.max(action?.weight ?? 0, dummy?.weight ?? 0));
      }
      // Visual root already has +.01m; preserve that offset and cap correction.
      const maxLift = reaction?.kind.startsWith("keeper")
        ? 0.14
        : 0.06 +
          0.03 *
            smooth(0, 0.05, Math.max(action?.weight ?? 0, dummy?.weight ?? 0));
      const lift = clamp(-min - 0.01 + 0.002, 0, maxLift);
      bones.pelvis.position.z += lift;
    },
  };
}
