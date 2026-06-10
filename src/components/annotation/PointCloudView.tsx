import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2, AlertTriangle, Box as BoxIcon } from "lucide-react";
import { Annotation, AnnotationTool, BoundingBox3dAnnotation, TagColor } from "@/types/annotation";
import {
  parseNpz,
  findPointCloudCandidates,
  toPointCloud,
  type NpyArray,
} from "@/lib/npzLoader";

interface PointCloudViewProps {
  fileUrl: string;
  fileName?: string;
  annotations?: Annotation[];
  activeTool?: AnnotationTool;
  selectedAnnotation?: string | null;
  activeLabel?: string;
  activeColor?: TagColor;
  onAnnotationCreate?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationSelect?: (id: string | null) => void;
  onViewControlsReady?: (controls: {
    resetView: () => void;
    topView: () => void;
    frontView: () => void;
    sideView: () => void;
  }) => void;
}

const TAG_HEX: Record<TagColor, number> = {
  blue: 0x3b82f6,
  green: 0x22c55e,
  yellow: 0xeab308,
  purple: 0xa855f7,
  pink: 0xec4899,
  orange: 0xf97316,
  cyan: 0x22d3ee,
  red: 0xef4444,
};

interface BoxObject {
  group: THREE.Group;
  edges: THREE.LineSegments;
  fill: THREE.Mesh;
  baseColor: number;
  // Live transform reflecting any in-progress edit (committed on pointerup)
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  color: TagColor;
  label: string;
}

type DragMode =
  | { kind: "translate"; id: string; plane: THREE.Plane; offset: THREE.Vector3; moved: boolean }
  | { kind: "resize-xy"; id: string; anchor: THREE.Vector2 }
  | { kind: "resize-z"; id: string; bottomZ: number; planeNormal: THREE.Vector3 };

/**
 * 3D point cloud workspace.
 *  - Select tool: orbit + click-to-select + drag body to move + drag handles to resize.
 *  - Bounding Box tool: click & drag on the ground plane to draw a new 3D cuboid.
 */
export function PointCloudView({
  fileUrl,
  fileName,
  annotations = [],
  activeTool = "select",
  selectedAnnotation = null,
  activeLabel = "Object",
  activeColor = "cyan",
  onAnnotationCreate,
  onAnnotationUpdate,
  onAnnotationSelect,
  onViewControlsReady,
}: PointCloudViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointCount, setPointCount] = useState<number>(0);
  // NPZ-specific state: candidates surfaced when archive contains multiple
  // point-cloud arrays so the user can pick which one to render.
  const [npzCandidates, setNpzCandidates] = useState<NpyArray[] | null>(null);
  const applyNpzArrayRef = useRef<((arr: NpyArray) => void) | null>(null);
  const isNpz = !!fileName?.toLowerCase().endsWith(".npz") || /\.npz(\?|$)/i.test(fileUrl);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boxObjectsRef = useRef<Map<string, BoxObject>>(new Map());
  const annotationsGroupRef = useRef<THREE.Group | null>(null);
  // Handles for the currently selected box
  const handlesGroupRef = useRef<THREE.Group | null>(null);
  const cornerHandlesRef = useRef<THREE.Mesh[]>([]); // 4 bottom corners
  const heightHandleRef = useRef<THREE.Mesh | null>(null);
  const boundingSphereRef = useRef<THREE.Sphere | null>(null);

  const activeToolRef = useRef(activeTool);
  const activeLabelRef = useRef(activeLabel);
  const activeColorRef = useRef(activeColor);
  const selectedRef = useRef(selectedAnnotation);
  const onCreateRef = useRef(onAnnotationCreate);
  const onUpdateRef = useRef(onAnnotationUpdate);
  const onSelectRef = useRef(onAnnotationSelect);
  const annotationsRef = useRef(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    activeLabelRef.current = activeLabel;
  }, [activeLabel]);
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  useEffect(() => {
    selectedRef.current = selectedAnnotation;
  }, [selectedAnnotation]);
  useEffect(() => {
    onCreateRef.current = onAnnotationCreate;
  }, [onAnnotationCreate]);
  useEffect(() => {
    onUpdateRef.current = onAnnotationUpdate;
  }, [onAnnotationUpdate]);
  useEffect(() => {
    onSelectRef.current = onAnnotationSelect;
  }, [onAnnotationSelect]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = activeTool !== "boundingBox" && activeTool !== "boundingBox3d";
    }
  }, [activeTool]);

  // Initialize scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 5000);
    camera.position.set(5, 5, 5);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enabled = activeToolRef.current !== "boundingBox" && activeToolRef.current !== "boundingBox3d";
    controlsRef.current = controls;

    const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const axes = new THREE.AxesHelper(2);
    scene.add(axes);

    const annotationsGroup = new THREE.Group();
    annotationsGroup.name = "annotations";
    scene.add(annotationsGroup);
    annotationsGroupRef.current = annotationsGroup;

    const handlesGroup = new THREE.Group();
    handlesGroup.name = "handles";
    handlesGroup.visible = false;
    scene.add(handlesGroup);
    handlesGroupRef.current = handlesGroup;

    // Build re-usable handle meshes (4 bottom corners + 1 top)
    const makeHandle = (color: number) => {
      const geom = new THREE.SphereGeometry(0.12, 16, 12);
      const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
      const m = new THREE.Mesh(geom, mat);
      m.renderOrder = 999;
      return m;
    };
    const corners = [0, 1, 2, 3].map(() => {
      const m = makeHandle(0xffffff);
      m.userData.handle = "corner";
      handlesGroup.add(m);
      return m;
    });
    cornerHandlesRef.current = corners;
    const topHandle = makeHandle(0x22d3ee);
    topHandle.userData.handle = "top";
    handlesGroup.add(topHandle);
    heightHandleRef.current = topHandle;

    // Drawing / dragging state
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    const ndcOf = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -(((ev.clientY - rect.top) / rect.height) * 2 - 1),
      );
    };
    const intersectGround = (ev: PointerEvent): THREE.Vector3 | null => {
      raycaster.setFromCamera(ndcOf(ev), camera);
      const hit = new THREE.Vector3();
      return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
    };
    const intersectVertical = (ev: PointerEvent, normal: THREE.Vector3, point: THREE.Vector3): THREE.Vector3 | null => {
      // Vertical plane through `point` with horizontal normal
      const plane = new THREE.Plane(normal, -normal.dot(point));
      raycaster.setFromCamera(ndcOf(ev), camera);
      const hit = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    };

    // -------- Drawing new boxes --------
    let drawing = false;
    let drawStart: THREE.Vector3 | null = null;
    let previewBox: THREE.LineSegments | null = null;
    const DEFAULT_HEIGHT = 1.5;
    const buildPreview = (a: THREE.Vector3, b: THREE.Vector3) => {
      const sx = Math.max(Math.abs(b.x - a.x), 0.05);
      const sy = Math.max(Math.abs(b.y - a.y), 0.05);
      const sz = DEFAULT_HEIGHT;
      const geom = new THREE.BoxGeometry(sx, sy, sz);
      const edges = new THREE.EdgesGeometry(geom);
      const mat = new THREE.LineBasicMaterial({ color: TAG_HEX[activeColorRef.current] || 0x22d3ee });
      const lines = new THREE.LineSegments(edges, mat);
      lines.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, sz / 2);
      geom.dispose();
      return lines;
    };

    // -------- Editing existing boxes --------
    let drag: DragMode | null = null;
    let pendingTranslate: { id: string; startScreen: THREE.Vector2; plane: THREE.Plane; offset: THREE.Vector3 } | null =
      null;
    const TRANSLATE_THRESHOLD = 4; // pixels

    const intersectPlane = (ev: PointerEvent, plane: THREE.Plane): THREE.Vector3 | null => {
      raycaster.setFromCamera(ndcOf(ev), camera);
      const hit = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    };
    const makeCameraFacingPlaneAt = (center: THREE.Vector3): THREE.Plane => {
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir); // points away from camera
      const normal = camDir.clone().multiplyScalar(-1).normalize();
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(normal, center);
      return plane;
    };

    const updateGroupTransform = (obj: BoxObject) => {
      obj.group.position.set(obj.cx, obj.cy, obj.cz);
      obj.group.scale.set(obj.sx, obj.sy, obj.sz);
    };
    const positionHandlesFor = (obj: BoxObject) => {
      const hx = obj.sx / 2;
      const hy = obj.sy / 2;
      const hz = obj.sz / 2;
      const corners = cornerHandlesRef.current;
      // Bottom corners (z = cz - hz)
      corners[0].position.set(obj.cx - hx, obj.cy - hy, obj.cz - hz);
      corners[1].position.set(obj.cx + hx, obj.cy - hy, obj.cz - hz);
      corners[2].position.set(obj.cx + hx, obj.cy + hy, obj.cz - hz);
      corners[3].position.set(obj.cx - hx, obj.cy + hy, obj.cz - hz);
      // Persist anchor info on each corner: opposite corner in XY
      corners[0].userData.opposite = new THREE.Vector2(obj.cx + hx, obj.cy + hy);
      corners[1].userData.opposite = new THREE.Vector2(obj.cx - hx, obj.cy + hy);
      corners[2].userData.opposite = new THREE.Vector2(obj.cx - hx, obj.cy - hy);
      corners[3].userData.opposite = new THREE.Vector2(obj.cx + hx, obj.cy - hy);
      const top = heightHandleRef.current!;
      top.position.set(obj.cx, obj.cy, obj.cz + hz);
    };
    const refreshHandlesIfSelected = (id: string) => {
      if (selectedRef.current === id) {
        const obj = boxObjectsRef.current.get(id);
        if (obj) positionHandlesFor(obj);
      }
    };

    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const tool = activeToolRef.current;
      raycaster.setFromCamera(ndcOf(ev), camera);

      // 1) If something is selected and we hit a handle, start a resize drag
      const selectedId = selectedRef.current;
      if (selectedId && tool === "select" && handlesGroupRef.current?.visible) {
        const handleHits = raycaster.intersectObjects(handlesGroup.children, false);
        if (handleHits.length > 0) {
          const handle = handleHits[0].object as THREE.Mesh;
          if (handle.userData.handle === "corner") {
            const anchor = handle.userData.opposite as THREE.Vector2;
            drag = { kind: "resize-xy", id: selectedId, anchor: anchor.clone() };
          } else if (handle.userData.handle === "top") {
            const obj = boxObjectsRef.current.get(selectedId);
            if (obj) {
              // Use a vertical plane that faces the camera and passes through the box center
              const camDir = new THREE.Vector3();
              camera.getWorldDirection(camDir);
              const normal = new THREE.Vector3(-camDir.x, -camDir.y, 0).normalize();
              if (normal.lengthSq() < 0.001) normal.set(1, 0, 0);
              drag = { kind: "resize-z", id: selectedId, bottomZ: obj.cz - obj.sz / 2, planeNormal: normal };
            }
          }
          if (drag) {
            controls.enabled = false;
            (ev.target as Element).setPointerCapture?.(ev.pointerId);
            ev.preventDefault();
            return;
          }
        }
      }

      // 2) Box-tool drawing
      if (tool === "boundingBox" || tool === "boundingBox3d") {
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, hit)) {
          drawing = true;
          drawStart = hit;
          (ev.target as Element).setPointerCapture?.(ev.pointerId);
          ev.preventDefault();
        }
        return;
      }

      // 3) Select tool: hit on a box body → potential translate (commits as click-to-select if no movement)
      if (tool === "select") {
        const meshes: THREE.Object3D[] = [];
        annotationsGroup.children.forEach((g) => g.children.forEach((c) => meshes.push(c)));
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          let parent: THREE.Object3D | null = hits[0].object;
          while (parent && !parent.userData.annotationId) parent = parent.parent;
          if (parent?.userData.annotationId) {
            const id = parent.userData.annotationId as string;
            const obj = boxObjectsRef.current.get(id);
            if (obj) {
              const center = new THREE.Vector3(obj.cx, obj.cy, obj.cz);
              const plane = makeCameraFacingPlaneAt(center);
              const planeHit = new THREE.Vector3();
              if (raycaster.ray.intersectPlane(plane, planeHit)) {
                // offset = box.position - raycast(mousedown, plane)
                const offset = center.clone().sub(planeHit);
                pendingTranslate = {
                  id,
                  startScreen: new THREE.Vector2(ev.clientX, ev.clientY),
                  plane,
                  offset,
                };
                // Disable orbit immediately on mousedown over a box body
                controls.enabled = false;
                (ev.target as Element).setPointerCapture?.(ev.pointerId);
                ev.preventDefault();
              }
            }
          }
        }
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      // Drawing preview
      if (drawing && drawStart) {
        const p = intersectGround(ev);
        if (!p) return;
        if (previewBox) {
          scene.remove(previewBox);
          previewBox.geometry.dispose();
          (previewBox.material as THREE.Material).dispose();
        }
        previewBox = buildPreview(drawStart, p);
        scene.add(previewBox);
        return;
      }

      // Resize/translate via handle
      if (drag) {
        const obj = boxObjectsRef.current.get(drag.id);
        if (!obj) return;
        if (drag.kind === "resize-xy") {
          const p = intersectGround(ev);
          if (!p) return;
          const sx = Math.max(Math.abs(p.x - drag.anchor.x), 0.05);
          const sy = Math.max(Math.abs(p.y - drag.anchor.y), 0.05);
          obj.sx = sx;
          obj.sy = sy;
          obj.cx = (p.x + drag.anchor.x) / 2;
          obj.cy = (p.y + drag.anchor.y) / 2;
          updateGroupTransform(obj);
          positionHandlesFor(obj);
        } else if (drag.kind === "resize-z") {
          const p = intersectVertical(ev, drag.planeNormal, new THREE.Vector3(obj.cx, obj.cy, obj.cz));
          if (!p) return;
          const top = Math.max(p.z, drag.bottomZ + 0.05);
          obj.sz = top - drag.bottomZ;
          obj.cz = (top + drag.bottomZ) / 2;
          updateGroupTransform(obj);
          positionHandlesFor(obj);
        }
        return;
      }

      // Pending body translate
      if (pendingTranslate) {
        const dx = ev.clientX - pendingTranslate.startScreen.x;
        const dy = ev.clientY - pendingTranslate.startScreen.y;
        if (Math.hypot(dx, dy) >= TRANSLATE_THRESHOLD) {
          // Promote to active translate drag
          drag = {
            kind: "translate",
            id: pendingTranslate.id,
            plane: pendingTranslate.plane,
            offset: pendingTranslate.offset.clone(),
            moved: true,
          };
          controls.enabled = false;
          pendingTranslate = null;
        }
      }
      if (drag && drag.kind === "translate") {
        const p = intersectPlane(ev, drag.plane);
        if (!p) return;
        const obj = boxObjectsRef.current.get(drag.id);
        if (!obj) return;
        // box.position = raycast(mousemove, plane) + offset
        const newCenter = p.clone().add(drag.offset);
        obj.cx = newCenter.x;
        obj.cy = newCenter.y;
        obj.cz = newCenter.z;
        updateGroupTransform(obj);
        positionHandlesFor(obj);
      }
    };

    const finishPointer = (ev: PointerEvent) => {
      // Finish drawing → create
      if (drawing && drawStart) {
        const p = intersectGround(ev);
        drawing = false;
        if (previewBox) {
          scene.remove(previewBox);
          previewBox.geometry.dispose();
          (previewBox.material as THREE.Material).dispose();
          previewBox = null;
        }
        const start = drawStart;
        drawStart = null;
        if (p) {
          const sx = Math.abs(p.x - start.x);
          const sy = Math.abs(p.y - start.y);
          if (sx >= 0.05 || sy >= 0.05) {
            const sz = DEFAULT_HEIGHT;
            const annotation: BoundingBox3dAnnotation = {
              id: crypto.randomUUID(),
              type: "boundingBox3d",
              cx: (p.x + start.x) / 2,
              cy: (p.y + start.y) / 2,
              cz: sz / 2,
              sx: Math.max(sx, 0.05),
              sy: Math.max(sy, 0.05),
              sz,
              label: activeLabelRef.current,
              color: activeColorRef.current,
            };
            onCreateRef.current?.(annotation as unknown as Annotation);
          }
        }
        return;
      }

      // Finish drag → commit update
      if (drag) {
        const obj = boxObjectsRef.current.get(drag.id);
        if (obj && onUpdateRef.current) {
          const updated: BoundingBox3dAnnotation = {
            id: drag.id,
            type: "boundingBox3d",
            cx: obj.cx,
            cy: obj.cy,
            cz: obj.cz,
            sx: obj.sx,
            sy: obj.sy,
            sz: obj.sz,
            label: obj.label,
            color: obj.color,
          };
          // Preserve any extra metadata from the original annotation prop
          const original = annotationsRef.current.find((a) => a.id === drag!.id);
          const merged = { ...(original || {}), ...updated } as Annotation;
          onUpdateRef.current(merged);
        }
        drag = null;
        if (activeToolRef.current === "select") controls.enabled = true;
        return;
      }

      // Pending translate that never moved → treat as click-to-select
      if (pendingTranslate) {
        onSelectRef.current?.(pendingTranslate.id);
        pendingTranslate = null;
        if (activeToolRef.current === "select") controls.enabled = true;
      }
    };

    const dom = renderer.domElement;
    // Move/up listeners are attached to `document` on every pointerdown so
    // drag/draw state created inside handlePointerDown is tracked immediately,
    // even if the cursor leaves the canvas before the next event. They are
    // detached on pointerup/cancel.
    let docListenersAttached = false;
    const attachDocListeners = () => {
      if (docListenersAttached) return;
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", finishPointerAndDetach);
      document.addEventListener("pointercancel", finishPointerAndDetach);
      docListenersAttached = true;
    };
    const detachDocListeners = () => {
      if (!docListenersAttached) return;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", finishPointerAndDetach);
      document.removeEventListener("pointercancel", finishPointerAndDetach);
      docListenersAttached = false;
    };
    const finishPointerAndDetach = (ev: PointerEvent) => {
      finishPointer(ev);
      detachDocListeners();
    };
    const handlePointerDownWrapped = (ev: PointerEvent) => {
      attachDocListeners();
      handlePointerDown(ev);
    };
    dom.addEventListener("pointerdown", handlePointerDownWrapped);

    // Holds the currently rendered THREE.Points so it can be swapped when the
    // user picks a different NPZ array.
    let currentPoints: THREE.Points | null = null;
    const frameSceneToGeometry = (geom: THREE.BufferGeometry) => {
      geom.computeBoundingSphere();
      const sphere = geom.boundingSphere;
      if (sphere) {
        const r = sphere.radius || 1;
        camera.position.copy(sphere.center.clone().add(new THREE.Vector3(r, r, r)));
        controls.target.copy(sphere.center);
        camera.near = Math.max(r / 1000, 0.001);
        camera.far = r * 100;
        camera.updateProjectionMatrix();
        boundingSphereRef.current = sphere.clone();
      }
    };
    const applyPointCloud = (positions: Float32Array, intensities?: Float32Array) => {
      if (disposed) return;
      if (currentPoints) {
        scene.remove(currentPoints);
        currentPoints.geometry.dispose();
        (currentPoints.material as THREE.Material).dispose();
        currentPoints = null;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ size: 0.03, sizeAttenuation: true });
      if (intensities && intensities.length * 3 === positions.length) {
        const colors = new Float32Array(intensities.length * 3);
        for (let i = 0; i < intensities.length; i++) {
          const v = intensities[i];
          // Cyan-tinted intensity ramp
          colors[i * 3] = v * 0.2;
          colors[i * 3 + 1] = 0.4 + v * 0.6;
          colors[i * 3 + 2] = 0.7 + v * 0.3;
        }
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        material.vertexColors = true;
      } else {
        material.color = new THREE.Color(0x22d3ee);
      }
      const points = new THREE.Points(geom, material);
      scene.add(points);
      currentPoints = points;
      frameSceneToGeometry(geom);
      setPointCount(positions.length / 3);
      setLoading(false);
    };

    if (isNpz) {
      applyNpzArrayRef.current = (arr: NpyArray) => {
        try {
          const pc = toPointCloud(arr);
          applyPointCloud(pc.positions, pc.intensities);
          setNpzCandidates(null);
        } catch (e: any) {
          setError(e?.message || "Failed to load selected NPZ array.");
          setLoading(false);
        }
      };
      (async () => {
        try {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status} while fetching .npz`);
          const buf = await res.arrayBuffer();
          const arrays = await parseNpz(buf);
          if (disposed) return;
          const candidates = findPointCloudCandidates(arrays);
          if (candidates.length === 0) {
            const desc = arrays
              .map((a) => `${a.name}: shape=[${a.shape.join(",")}] dtype=${a.dtype}`)
              .join("; ");
            throw new Error(
              `No point-cloud array found in NPZ. Expected a 2D float32/float64 array with shape [N,3] or [N,4]. Found: ${desc}`,
            );
          }
          if (candidates.length === 1) {
            applyNpzArrayRef.current?.(candidates[0]);
          } else {
            setNpzCandidates(candidates);
            setLoading(false);
          }
        } catch (e: any) {
          if (disposed) return;
          console.error("NPZ load failed", e);
          setError(e?.message || "Failed to load NPZ point cloud.");
          setLoading(false);
        }
      })();
    } else {
      const loader = new PCDLoader();
      loader.load(
        fileUrl,
        (points) => {
          if (disposed) return;
          const material = points.material as THREE.PointsMaterial;
          material.size = 0.03;
          material.sizeAttenuation = true;
          if (!(points.geometry.attributes as any).color) {
            material.color = new THREE.Color(0x22d3ee);
          } else {
            material.vertexColors = true;
          }
          scene.add(points);
          currentPoints = points;
          frameSceneToGeometry(points.geometry);
          const count = (points.geometry.attributes as any).position?.count ?? 0;
          setPointCount(count);
          setLoading(false);
        },
        undefined,
        (err) => {
          console.error("PCD load failed", err);
          if (disposed) return;
          setError("Failed to load point cloud. Make sure the file is a valid .pcd (ASCII or binary).");
          setLoading(false);
        },
      );
    }

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObs.disconnect();
      dom.removeEventListener("pointerdown", handlePointerDownWrapped);
      detachDocListeners();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        const o = obj as any;
        if (o.geometry?.dispose) o.geometry.dispose();
        if (o.material?.dispose) o.material.dispose();
      });
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      annotationsGroupRef.current = null;
      handlesGroupRef.current = null;
      cornerHandlesRef.current = [];
      heightHandleRef.current = null;
      boxObjectsRef.current.clear();
    };
  }, [fileUrl]);

  // Expose camera view controls (Reset / Top / Front / Side) to parent
  useEffect(() => {
    if (!onViewControlsReady) return;
    const setView = (offset: THREE.Vector3) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      const sphere = boundingSphereRef.current;
      const center = sphere ? sphere.center.clone() : new THREE.Vector3(0, 0, 0);
      const r = sphere?.radius || 5;
      const dist = Math.max(r * 2.2, 1);
      camera.position.copy(center.clone().add(offset.clone().normalize().multiplyScalar(dist)));
      controls.target.copy(center);
      camera.near = Math.max(r / 1000, 0.001);
      camera.far = r * 100;
      camera.updateProjectionMatrix();
      controls.update();
    };
    onViewControlsReady({
      resetView: () => setView(new THREE.Vector3(1, 1, 1)),
      // Slight Y offset avoids gimbal lock with Z-up camera looking straight down
      topView: () => setView(new THREE.Vector3(0, -0.0001, 1)),
      frontView: () => setView(new THREE.Vector3(1, 0, 0)),
      sideView: () => setView(new THREE.Vector3(0, 1, 0)),
    });
  }, [onViewControlsReady]);

  // Sync annotations → scene
  useEffect(() => {
    const group = annotationsGroupRef.current;
    if (!group) return;

    const incoming = annotations.filter((a): a is BoundingBox3dAnnotation => a.type === "boundingBox3d");
    const incomingIds = new Set(incoming.map((a) => a.id));

    for (const [id, obj] of boxObjectsRef.current) {
      if (!incomingIds.has(id)) {
        group.remove(obj.group);
        obj.edges.geometry.dispose();
        (obj.edges.material as THREE.Material).dispose();
        obj.fill.geometry.dispose();
        (obj.fill.material as THREE.Material).dispose();
        boxObjectsRef.current.delete(id);
      }
    }

    for (const a of incoming) {
      const existing = boxObjectsRef.current.get(a.id);
      const color = TAG_HEX[a.color] ?? 0x22d3ee;
      if (existing) {
        existing.cx = a.cx;
        existing.cy = a.cy;
        existing.cz = a.cz;
        existing.sx = a.sx;
        existing.sy = a.sy;
        existing.sz = a.sz;
        existing.label = a.label;
        existing.color = a.color;
        existing.baseColor = color;
        existing.group.position.set(a.cx, a.cy, a.cz);
        existing.group.scale.set(a.sx, a.sy, a.sz);
        (existing.edges.material as THREE.LineBasicMaterial).color.setHex(color);
        (existing.fill.material as THREE.MeshBasicMaterial).color.setHex(color);
      } else {
        const unitGeom = new THREE.BoxGeometry(1, 1, 1);
        const edgesGeom = new THREE.EdgesGeometry(unitGeom);
        const lineMat = new THREE.LineBasicMaterial({ color });
        const edges = new THREE.LineSegments(edgesGeom, lineMat);
        const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false });
        const fill = new THREE.Mesh(unitGeom, fillMat);
        const grp = new THREE.Group();
        grp.add(fill);
        grp.add(edges);
        grp.position.set(a.cx, a.cy, a.cz);
        grp.scale.set(a.sx, a.sy, a.sz);
        grp.userData.annotationId = a.id;
        group.add(grp);
        boxObjectsRef.current.set(a.id, {
          group: grp,
          edges,
          fill,
          baseColor: color,
          cx: a.cx,
          cy: a.cy,
          cz: a.cz,
          sx: a.sx,
          sy: a.sy,
          sz: a.sz,
          color: a.color,
          label: a.label,
        });
      }
    }
  }, [annotations]);

  // Selection visuals + handle placement
  useEffect(() => {
    const handlesGroup = handlesGroupRef.current;
    for (const [id, obj] of boxObjectsRef.current) {
      const isSelected = id === selectedAnnotation;
      (obj.edges.material as THREE.LineBasicMaterial).color.setHex(isSelected ? 0xffffff : obj.baseColor);
      (obj.fill.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.22 : 0.08;
    }
    if (!handlesGroup) return;
    const sel = selectedAnnotation ? boxObjectsRef.current.get(selectedAnnotation) : null;
    if (sel && activeTool === "select") {
      handlesGroup.visible = true;
      const corners = cornerHandlesRef.current;
      const hx = sel.sx / 2,
        hy = sel.sy / 2,
        hz = sel.sz / 2;
      corners[0].position.set(sel.cx - hx, sel.cy - hy, sel.cz - hz);
      corners[1].position.set(sel.cx + hx, sel.cy - hy, sel.cz - hz);
      corners[2].position.set(sel.cx + hx, sel.cy + hy, sel.cz - hz);
      corners[3].position.set(sel.cx - hx, sel.cy + hy, sel.cz - hz);
      corners[0].userData.opposite = new THREE.Vector2(sel.cx + hx, sel.cy + hy);
      corners[1].userData.opposite = new THREE.Vector2(sel.cx - hx, sel.cy + hy);
      corners[2].userData.opposite = new THREE.Vector2(sel.cx - hx, sel.cy - hy);
      corners[3].userData.opposite = new THREE.Vector2(sel.cx + hx, sel.cy - hy);
      heightHandleRef.current?.position.set(sel.cx, sel.cy, sel.cz + hz);
    } else {
      handlesGroup.visible = false;
    }
  }, [selectedAnnotation, annotations, activeTool]);

  const cursorClass =
    activeTool === "boundingBox" || activeTool === "boundingBox3d" ? "cursor-crosshair" : "cursor-grab";

  return (
    <div className="relative flex-1 min-h-0 w-full bg-[#0b1220]">
      <div ref={containerRef} className={`absolute inset-0 ${cursorClass}`} />
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-md bg-background/70 backdrop-blur px-3 py-1.5 text-xs text-foreground border border-border">
        <BoxIcon className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{fileName || "Point Cloud"}</span>
        {pointCount > 0 && <span className="text-muted-foreground">· {pointCount.toLocaleString()} pts</span>}
        {isNpz && (
          <span className="ml-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
            NPZ · Experimental
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/70 backdrop-blur px-3 py-1.5 text-[11px] text-muted-foreground border border-border">
        {activeTool === "boundingBox" || activeTool === "boundingBox3d"
          ? "Click & drag on the ground to draw a 3D box"
          : selectedAnnotation
            ? "Drag the box to move · Drag white corners to resize · Drag cyan top to change height"
            : "Drag to rotate · Right-click to pan · Scroll to zoom"}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading point cloud…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-2 text-center max-w-sm px-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        </div>
      )}
      {npzCandidates && npzCandidates.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex flex-col gap-3 max-w-md w-full px-6 py-5 rounded-lg border border-border bg-background/95 shadow-xl">
            <div>
              <p className="text-sm font-semibold text-foreground">Multiple point-cloud arrays found</p>
              <p className="text-xs text-muted-foreground">
                Select which array inside this .npz to render.
              </p>
            </div>
            <div className="flex flex-col gap-2 max-h-64 overflow-auto">
              {npzCandidates.map((arr) => (
                <button
                  key={arr.name}
                  type="button"
                  onClick={() => applyNpzArrayRef.current?.(arr)}
                  className="text-left rounded-md border border-border hover:border-primary/60 hover:bg-primary/5 px-3 py-2 transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">{arr.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    shape [{arr.shape.join(", ")}] · dtype {arr.dtype} ·{" "}
                    {arr.shape[1] === 4 ? "XYZI" : "XYZ"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
