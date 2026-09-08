import { describe, expect, it } from 'vitest'
import { capabilitiesForNode, getImportFormat, isSupportedModelFile } from './editorCapabilities'

describe('avatar studio editor capabilities', () => {
  it('recognizes supported model formats', () => {
    expect(getImportFormat('character.obj')).toBe('obj')
    expect(getImportFormat('character.FBX')).toBe('fbx')
    expect(isSupportedModelFile('character.vrm')).toBe(true)
    expect(isSupportedModelFile('notes.txt')).toBe(false)
  })

  it('only enables texture paint for UV-mapped textured meshes', () => {
    expect(capabilitiesForNode('glb', { isMesh: true, hasUv: true, hasTexture: true }).texturePaint).toBe(true)
    expect(capabilitiesForNode('glb', { isMesh: true, hasUv: false, hasTexture: true }).texturePaint).toBe(false)
  })
})
