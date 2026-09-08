import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Minimal scene: sphere head + small torso box (procedural default model)
// Export as GLB so GLTFLoader can load it; VrmModel will treat it as "not a valid VRM — showing fallback"
// but the GLB itself is valid and proves the loader pipeline works.
const scene = new THREE.Scene()
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })
)
head.position.set(0, 1.45, 0)
scene.add(head)
const torso = new THREE.Mesh(
  new THREE.BoxGeometry(0.4, 0.45, 0.22),
  new THREE.MeshStandardMaterial({ color: 0x18181b })
)
torso.position.set(0, 1.05, 0)
scene.add(torso)

const exporter = new GLTFExporter()
exporter.parse(scene, (gltf) => {
  const out = Buffer.isBuffer(gltf) ? gltf : Buffer.from(gltf)
  const destDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/avatars/vrm')
  fs.mkdirSync(destDir, { recursive: true })
  const mono = path.join(destDir, 'eve-mono.glb')
  const vrm = path.join(destDir, 'eve-mono.vrm')
  fs.writeFileSync(mono, out)
  // Also write .vrm copy (same GLB, just extension) — VrmModel HEAD probe will succeed, loader will fallback gracefully
  fs.writeFileSync(vrm, out)
  const duo = path.join(destDir, 'eve-duo.vrm')
  fs.writeFileSync(duo, out)
  const duoGlb = path.join(destDir, 'eve-duo.glb')
  fs.writeFileSync(duoGlb, out)
  console.log('Generated GLB', mono, out.length, 'bytes')
}, (err) => { console.error(err); process.exit(1) }, { binary: true })
