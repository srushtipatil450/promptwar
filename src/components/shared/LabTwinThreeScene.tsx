import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EquipmentItem, PhysicalUnit } from '../../types/lablink';

export interface TwinBenchNode {
  equipment: EquipmentItem;
  units: PhysicalUnit[];
  benchIndex: number;
  availableCount: number;
  maintCount: number;
}

interface LabTwinThreeSceneProps {
  nodes: TwinBenchNode[];
  selectedEquipmentId: string;
  onSelectEquipment: (equipmentId: string) => void;
  onHoverEquipment?: (hover: { equipmentId: string; x: number; y: number } | null) => void;
  onWebglUnavailable: () => void;
  resetTrigger: number;
}

function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    return /SwiftShader|llvmpipe|Software Rasterizer/i.test(renderer);
  } catch {
    return false;
  }
}

export const LabTwinThreeScene: React.FC<LabTwinThreeSceneProps> = ({
  nodes,
  selectedEquipmentId,
  onSelectEquipment,
  onHoverEquipment,
  onWebglUnavailable,
  resetTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef(selectedEquipmentId);
  selectedRef.current = selectedEquipmentId;

  const onSelectRef = useRef(onSelectEquipment);
  onSelectRef.current = onSelectEquipment;

  const onHoverRef = useRef(onHoverEquipment);
  onHoverRef.current = onHoverEquipment;

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (resetTrigger > 0 && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(8.5, 6.8, 9.2);
      controlsRef.current.target.set(0, 0.7, 0);
      controlsRef.current.update();
    }
  }, [resetTrigger]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      onWebglUnavailable();
      return;
    }

    const gl = renderer.getContext();
    if (!gl || isSoftwareRenderer(gl)) {
      renderer.dispose();
      onWebglUnavailable();
      return;
    }

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(340, container.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F7F9FC');
    scene.fog = new THREE.Fog('#F7F9FC', 18, 36);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(8.5, 6.8, 9.2);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 4.5;
    controls.maxDistance = 18;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2.22;
    controls.target.set(0, 0.7, 0);
    controlsRef.current = controls;

    // Three-point clean laboratory lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0xdbe5f5, 0.75);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffcf5, 1.35);
    keyLight.position.set(8, 12, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.55);
    rimLight.position.set(-7, 6, -8);
    scene.add(rimLight);

    // Root studio group allows subtle pointer-driven perspective depth without fighting OrbitControls
    const studioGroup = new THREE.Group();
    scene.add(studioGroup);

    // Architectural studio floor & subtle grid
    const floorGeo = new THREE.PlaneGeometry(28, 28);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xeef3fa,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    studioGroup.add(floor);

    const grid = new THREE.GridHelper(18, 18, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.005;
    studioGroup.add(grid);

    // Disposables registry
    const geometries: THREE.BufferGeometry[] = [floorGeo];
    const materials: THREE.Material[] = [floorMat];
    const clickables: THREE.Object3D[] = [];
    const benchGroups: Array<{
      equipmentId: string;
      ringMat: THREE.MeshBasicMaterial;
      statusMat: THREE.MeshStandardMaterial;
      group: THREE.Group;
      instrumentHead: THREE.Object3D;
    }> = [];

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };

    // Shared workbench materials
    const frameMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.35 })
    );
    const topMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.4 })
    );
    const chassisMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.3, roughness: 0.35 })
    );
    const accentBlueMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x3978e8, metalness: 0.25, roughness: 0.3 })
    );

    const count = Math.max(1, nodes.length);
    const cols = count <= 2 ? count : Math.ceil(count / 2);
    const spacingX = 3.8;
    const spacingZ = 3.6;

    nodes.forEach((node, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const totalRows = Math.ceil(count / cols);
      const x = (col - (cols - 1) / 2) * spacingX;
      const z = (row - (totalRows - 1) / 2) * spacingZ;

      const benchGroup = new THREE.Group();
      benchGroup.position.set(x, 0, z);
      benchGroup.userData.equipmentId = node.equipment.id;

      // Workbench top & legs
      const tableTop = new THREE.Mesh(regGeo(new THREE.BoxGeometry(2.5, 0.12, 1.6)), topMat);
      tableTop.position.y = 0.92;
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      tableTop.userData.equipmentId = node.equipment.id;
      benchGroup.add(tableTop);

      const legGeo = regGeo(new THREE.BoxGeometry(0.1, 0.9, 0.1));
      const legOffsets = [
        [-1.12, 0.45, -0.68],
        [1.12, 0.45, -0.68],
        [-1.12, 0.45, 0.68],
        [1.12, 0.45, 0.68],
      ];
      for (const [lx, ly, lz] of legOffsets) {
        const leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        leg.userData.equipmentId = node.equipment.id;
        benchGroup.add(leg);
      }

      // Status strip on front of workbench
      const statusHex =
        node.availableCount > 0
          ? 0x16a34a
          : node.maintCount === node.units.length
            ? 0xd97706
            : 0x3978e8;
      const statusMat = regMat(
        new THREE.MeshStandardMaterial({
          color: statusHex,
          emissive: statusHex,
          emissiveIntensity: 0.28,
          roughness: 0.3,
        })
      );
      const statusBar = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.7, 0.06, 0.06)), statusMat);
      statusBar.position.set(0, 0.92, 0.81);
      statusBar.userData.equipmentId = node.equipment.id;
      benchGroup.add(statusBar);

      // Selection / hover ring on floor
      const ringMat = regMat(
        new THREE.MeshBasicMaterial({
          color: 0x3978e8,
          transparent: true,
          opacity: node.equipment.id === selectedRef.current ? 0.9 : 0.0,
          side: THREE.DoubleSide,
        })
      );
      const ring = new THREE.Mesh(regGeo(new THREE.RingGeometry(1.42, 1.55, 48)), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      benchGroup.add(ring);

      // Procedural 3D Instrument Silhouette by category
      const instrumentGroup = new THREE.Group();
      instrumentGroup.position.set(0, 0.98, 0);
      const cat = node.equipment.category;

      if (cat === 'Robotics & Automation') {
        const base = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.32, 0.38, 0.22, 24)), frameMat);
        base.position.y = 0.11;
        base.castShadow = true;
        const arm1 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.16, 0.72, 0.16)), accentBlueMat);
        arm1.position.set(0, 0.52, 0);
        arm1.rotation.z = 0.25;
        arm1.castShadow = true;
        const arm2 = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.58, 0.14, 0.14)), chassisMat);
        arm2.position.set(0.18, 0.86, 0);
        arm2.castShadow = true;
        instrumentGroup.add(base, arm1, arm2);
      } else if (cat === 'Fabrication & CNC') {
        const enclosure = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.25, 0.85, 0.95)), chassisMat);
        enclosure.position.y = 0.425;
        enclosure.castShadow = true;
        const visorMat = regMat(
          new THREE.MeshPhysicalMaterial({
            color: 0x93c5fd,
            roughness: 0.15,
            transmission: 0.45,
            transparent: true,
            opacity: 0.68,
          })
        );
        const visor = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.95, 0.45, 0.06)), visorMat);
        visor.position.set(0, 0.52, 0.46);
        const gantry = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.95, 0.08, 0.12)), accentBlueMat);
        gantry.position.set(0, 0.55, 0);
        instrumentGroup.add(enclosure, visor, gantry);
      } else if (cat === 'Materials & Metrology') {
        const base = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.1, 0.18, 0.8)), frameMat);
        base.position.y = 0.09;
        const colL = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 16)), chassisMat);
        colL.position.set(-0.38, 0.66, 0);
        const colR = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 16)), chassisMat);
        colR.position.set(0.38, 0.66, 0);
        const crosshead = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.92, 0.16, 0.24)), accentBlueMat);
        crosshead.position.set(0, 0.84, 0);
        instrumentGroup.add(base, colL, colR, crosshead);
      } else {
        // Benchtop signal / thermal / bio analyzer with crisp display
        const body = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.18, 0.58, 0.68)), chassisMat);
        body.position.y = 0.29;
        body.castShadow = true;
        const screenMat = regMat(
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.35,
            roughness: 0.2,
          })
        );
        const screen = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.66, 0.36, 0.04)), screenMat);
        screen.position.set(-0.16, 0.34, 0.34);
        const dial = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16)), accentBlueMat);
        dial.rotation.x = Math.PI / 2;
        dial.position.set(0.36, 0.36, 0.34);
        instrumentGroup.add(body, screen, dial);
      }

      instrumentGroup.traverse((child) => {
        child.userData.equipmentId = node.equipment.id;
      });
      benchGroup.add(instrumentGroup);

      // Invisible generous hit-box for smooth clicking & hovering
      const hitMat = regMat(new THREE.MeshBasicMaterial({ visible: false }));
      const hitBox = new THREE.Mesh(regGeo(new THREE.BoxGeometry(2.6, 2.2, 1.8)), hitMat);
      hitBox.position.set(0, 1.1, 0);
      hitBox.userData.equipmentId = node.equipment.id;
      benchGroup.add(hitBox);
      clickables.push(hitBox);

      studioGroup.add(benchGroup);
      benchGroups.push({
        equipmentId: node.equipment.id,
        ringMat,
        statusMat,
        group: benchGroup,
        instrumentHead: instrumentGroup,
      });
    });

    // Pointer interaction (click vs drag, hover tooltip & subtle perspective tilt)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const pointerTarget = { x: 0, y: 0 };
    let isOrbitDragging = false;
    let hoveredEqId: string | null = null;
    let pointerDownPos = { x: 0, y: 0 };

    const handleControlStart = () => {
      isOrbitDragging = true;
      if (hoveredEqId) {
        hoveredEqId = null;
        onHoverRef.current?.(null);
      }
    };
    const handleControlEnd = () => {
      isOrbitDragging = false;
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('end', handleControlEnd);

    const updateMouse = (ev: PointerEvent) => {
      if (!renderer) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      return rect;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dist > 6) return; // Dragging camera, not clicking
      updateMouse(ev);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0) {
        const eqId = hits[0].object.userData.equipmentId as string | undefined;
        if (eqId) onSelectRef.current(eqId);
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return;
      const rect = updateMouse(ev);
      if (!rect) return;
      pointerTarget.x = mouse.x;
      pointerTarget.y = mouse.y;

      const now = performance.now();
      if (now - lastHoverCheck < 35) return;
      lastHoverCheck = now;

      if (isOrbitDragging) return;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      const hitEqId =
        hits.length > 0 ? ((hits[0].object.userData.equipmentId as string | undefined) ?? null) : null;

      if (renderer) {
        renderer.domElement.style.cursor = hitEqId ? 'pointer' : 'grab';
      }

      if (hitEqId) {
        hoveredEqId = hitEqId;
        onHoverRef.current?.({
          equipmentId: hitEqId,
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
        });
      } else if (hoveredEqId !== null) {
        hoveredEqId = null;
        onHoverRef.current?.(null);
      }
    };

    const onPointerLeave = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
      if (hoveredEqId !== null) {
        hoveredEqId = null;
        onHoverRef.current?.(null);
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerleave', onPointerLeave);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      onWebglUnavailable();
    };
    domEl.addEventListener('webglcontextlost', onContextLost);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!renderer) return;
      for (const entry of entries) {
        const w = Math.max(300, entry.contentRect.width);
        const h = Math.max(340, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle cursor-driven perspective response on studioGroup when not actively dragging
      const targetRotY = isOrbitDragging ? studioGroup.rotation.y : pointerTarget.x * 0.025;
      const targetRotX = isOrbitDragging ? studioGroup.rotation.x : -pointerTarget.y * 0.014;
      studioGroup.rotation.y += (targetRotY - studioGroup.rotation.y) * 0.08;
      studioGroup.rotation.x += (targetRotX - studioGroup.rotation.x) * 0.08;

      for (const item of benchGroups) {
        const isSel = item.equipmentId === selectedRef.current;
        const isHover = item.equipmentId === hoveredEqId;

        const targetRing = isSel ? 0.92 : isHover ? 0.45 : 0;
        item.ringMat.opacity += (targetRing - item.ringMat.opacity) * 0.16;

        const targetEmissive = isSel ? 0.65 : isHover ? 0.55 : 0.28;
        item.statusMat.emissiveIntensity +=
          (targetEmissive - item.statusMat.emissiveIntensity) * 0.16;

        const targetHeadY = isSel
          ? 0.995 + Math.sin(elapsed * 2.4) * 0.015
          : isHover
            ? 1.04
            : 0.98;
        item.instrumentHead.position.y +=
          (targetHeadY - item.instrumentHead.position.y) * 0.16;
      }
      controls.update();
      renderer?.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('end', handleControlEnd);
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerleave', onPointerLeave);
      domEl.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      envTarget.dispose();
      pmrem.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer?.dispose();
    };
  }, [nodes, onWebglUnavailable]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]"
      aria-label="Interactive 3D Laboratory Twin Viewport"
    />
  );
};

export default LabTwinThreeScene;
