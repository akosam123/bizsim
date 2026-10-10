// Vehicles: sedans, hatchbacks, a box truck. Shaped from side profiles so they
// read as cars, not boxes.
import * as THREE from 'three';
import { mat } from './people';

const glassMat = new THREE.MeshStandardMaterial({ color: '#1d2730', roughness: 0.08, metalness: 0.6 });
const tireMat = new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.9 });
const trimMat = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.6 });
const tire = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20).rotateX(Math.PI / 2);
const rim = new THREE.CylinderGeometry(0.2, 0.2, 0.23, 14).rotateX(Math.PI / 2);

function profile(points: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) s.lineTo(p[0], p[1]);
  return s;
}

function extrude(points: [number, number][], width: number, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(profile(points), { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

const BODY = {
  sedan: { len: 4.5, w: 1.78, lower: [[-2.25, 0.3], [2.2, 0.3], [2.28, 0.55], [2.15, 0.82], [1.0, 0.95], [-1.4, 0.98], [-2.2, 0.9], [-2.3, 0.6]] as [number, number][], cabin: [[-1.4, 0.95], [1.05, 0.95], [0.35, 1.42], [-0.85, 1.42], [-1.55, 1.0]] as [number, number][], axle: 1.38 },
  hatch: { len: 3.9, w: 1.72, lower: [[-1.9, 0.3], [1.95, 0.3], [2.0, 0.55], [1.85, 0.82], [0.85, 0.95], [-1.85, 0.98], [-1.98, 0.6]] as [number, number][], cabin: [[-1.85, 0.95], [0.9, 0.95], [0.2, 1.45], [-1.6, 1.45], [-1.92, 1.05]] as [number, number][], axle: 1.2 },
  suv: { len: 4.7, w: 1.9, lower: [[-2.3, 0.38], [2.3, 0.38], [2.36, 0.65], [2.2, 1.0], [1.1, 1.08], [-2.25, 1.1], [-2.36, 0.7]] as [number, number][], cabin: [[-2.2, 1.06], [1.15, 1.06], [0.5, 1.7], [-2.1, 1.72]] as [number, number][], axle: 1.45 },
};

export type CarKind = 'sedan' | 'hatch' | 'suv' | 'truck';

export function makeCar(color: string, kind: CarKind = 'sedan') {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const lightsF: THREE.Mesh[] = [];
  const lightsR: THREE.Mesh[] = [];
  const head = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffe9b0', emissiveIntensity: 0.2, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: '#6a0f0f', emissive: '#ff2a1a', emissiveIntensity: 0.25, roughness: 0.3 });
  if (kind === 'truck') {
    add(new THREE.BoxGeometry(1.9, 1.5, 2.05), paint, 2.35, 1.25, 0);
    add(new THREE.BoxGeometry(0.05, 0.7, 1.8), glassMat, 3.33, 1.6, 0);
    add(new THREE.BoxGeometry(4.6, 2.5, 2.2), mat('#eeeeea', 0.6), -1.1, 1.85, 0);
    add(new THREE.BoxGeometry(6.6, 0.25, 1.9), trimMat, 0.1, 0.55, 0);
    for (const x of [2.6, -0.4, -2.4]) for (const z of [0.86, -0.86]) { add(tire, tireMat, x, 0.38, z).scale.setScalar(1.15); add(rim, rimMat, x, 0.38, z * 1.01); }
    for (const z of [0.7, -0.7]) { lightsF.push(add(new THREE.BoxGeometry(0.05, 0.16, 0.3), head, 3.32, 0.85, z)); lightsR.push(add(new THREE.BoxGeometry(0.05, 0.18, 0.2), tail, -3.42, 0.9, z)); }
    return { group: g, length: 6.8, lightsF, lightsR };
  }
  const b = BODY[kind];
  add(extrude(b.lower, b.w), paint);
  add(extrude(b.cabin, b.w - 0.16, 0.03), glassMat);
  // roof panel and pillars painted
  const roofY = kind === 'suv' ? 1.71 : kind === 'hatch' ? 1.44 : 1.41;
  add(new THREE.BoxGeometry(kind === 'suv' ? 2.5 : kind === 'hatch' ? 1.75 : 1.25, 0.05, b.w - 0.2), paint, kind === 'suv' ? -0.8 : kind === 'hatch' ? -0.72 : -0.25, roofY, 0);
  add(new THREE.BoxGeometry(0.12, 0.06, b.w - 0.1), trimMat, b.len / 2 - 0.02, 0.45, 0);
  add(new THREE.BoxGeometry(0.12, 0.06, b.w - 0.1), trimMat, -b.len / 2 + 0.02, 0.45, 0);
  for (const x of [b.axle, -b.axle]) for (const z of [b.w / 2 - 0.12, -b.w / 2 + 0.12]) {
    add(tire, tireMat, x, 0.33, z);
    add(rim, rimMat, x, 0.33, z + Math.sign(z) * 0.01);
  }
  for (const z of [b.w / 2 - 0.32, -b.w / 2 + 0.32]) {
    lightsF.push(add(new THREE.BoxGeometry(0.06, 0.12, 0.34), head, b.len / 2 + 0.02, 0.72, z));
    lightsR.push(add(new THREE.BoxGeometry(0.06, 0.12, 0.3), tail, -b.len / 2 - 0.02, 0.78, z));
  }
  // side mirrors
  for (const z of [b.w / 2 + 0.06, -b.w / 2 - 0.06]) add(new THREE.BoxGeometry(0.15, 0.1, 0.1), paint, kind === 'suv' ? 1.0 : 0.95, 1.05, z);
  return { group: g, length: b.len, lightsF, lightsR };
}

export const CAR_COLORS = ['#b8252b', '#1f4e8c', '#e9e7e1', '#1d1f22', '#8a9096', '#c9a24a', '#3f6b52', '#5a2a3a', '#d5d0c4', '#24364f'];
