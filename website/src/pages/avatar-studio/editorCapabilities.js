export const MODEL_FORMATS = ['glb', 'gltf', 'vrm', 'obj', 'fbx']

export const FORMAT_CAPABILITIES = {
  glb: { transforms: true, materials: true, texturePaint: true, animation: true, exportGlb: true, exportVrm: false },
  gltf: { transforms: true, materials: true, texturePaint: true, animation: true, exportGlb: true, exportVrm: false },
  vrm: { transforms: true, materials: true, texturePaint: true, animation: true, exportGlb: true, exportVrm: false },
  obj: { transforms: true, materials: true, texturePaint: true, animation: false, exportGlb: true, exportVrm: false },
  fbx: { transforms: true, materials: true, texturePaint: true, animation: true, exportGlb: true, exportVrm: false },
}

export function normalizeFormat(format, fallback = 'glb') {
  const normalized = String(format || '').toLowerCase().replace('.', '')
  return MODEL_FORMATS.includes(normalized) ? normalized : fallback
}

export function capabilitiesForFormat(format) {
  return FORMAT_CAPABILITIES[normalizeFormat(format)] || FORMAT_CAPABILITIES.glb
}

export function capabilitiesForNode(format, node) {
  const base = capabilitiesForFormat(format)
  return {
    ...base,
    texturePaint: Boolean(base.texturePaint && node?.isMesh && node?.hasUv && node?.hasTexture),
  }
}

export function getImportFormat(filename) {
  const extension = String(filename || '').toLowerCase().split('.').pop()
  return normalizeFormat(extension, '')
}

export function isSupportedModelFile(filename) {
  return Boolean(getImportFormat(filename))
}
