// Static batching: fold many small meshes that share a material into one
// mesh per material. Hundreds of draw calls become a few dozen.
import * as THREE from 'three';

export function batch(root: THREE.Object3D, exclude: Set<THREE.Object3D> = new Set()) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[] }>();
  const victims: THREE.Mesh[] = [];
  const m = new THREE.Matrix4();

  const visit = (o: THREE.Object3D) => {
    if (o !== root && exclude.has(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(o as THREE.Points).isPoints && !Array.isArray(mesh.material) && o.visible && !o.userData.keep) {
      let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      m.multiplyMatrices(inv, mesh.matrixWorld);
      g.applyMatrix4(m);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      const mat = mesh.material as THREE.Material;
      const key = `${mat.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) { b = { mat, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [] }; buckets.set(key, b); }
      b.geos.push(g);
      victims.push(mesh);
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);

  for (const b of buckets.values()) {
    if (b.geos.length < 2) { b.geos.forEach((g) => g.dispose()); continue; }
    let n = 0;
    for (const g of b.geos) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of b.geos) {
      pos.set(g.attributes.position.array as Float32Array, o * 3);
      nor.set(g.attributes.normal.array as Float32Array, o * 3);
      uv.set(g.attributes.uv.array as Float32Array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.userData.batched = true;
    root.add(mesh);
    // only remove the originals that went into a real merge
    for (const v of victims) {
      if ((v.material as THREE.Material) === b.mat && v.castShadow === b.cast && v.receiveShadow === b.receive) v.userData.merged = true;
    }
  }
  for (const v of victims) {
    if (v.userData.merged) v.removeFromParent();
  }
}
