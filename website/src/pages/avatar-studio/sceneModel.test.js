import { describe, expect, it } from 'vitest'
import { cloneScene, createSceneProject, normalizeSceneProject, updateNode } from './sceneModel'
import { evaluateSceneAtFrame, upsertTransformKeyframe } from './animationModel'

describe('avatar modeling scene model', () => {
  it('creates a versioned scene with camera and editor collections', () => {
    const scene = createSceneProject({ id: 'eve', label: 'Eve', renderer: 'vrm', url: '/eve.vrm' })
    expect(scene.schemaVersion).toBe(2)
    expect(scene.model.id).toBe('eve')
    expect(scene.camera.position).toHaveLength(3)
    expect(scene.nodes).toEqual([])
  })

  it('normalizes partial saved scenes and updates nodes immutably', () => {
    const scene = normalizeSceneProject({ nodes: [{ id: 'mesh', name: 'Mesh', visible: true }] })
    const updated = updateNode(scene, 'mesh', { visible: false })
    expect(updated.nodes[0].visible).toBe(false)
    expect(scene.nodes[0].visible).toBe(true)
    expect(cloneScene(updated)).toEqual(updated)
  })

  it('migrates legacy keyframes into a transform clip and interpolates frames', () => {
    const scene = normalizeSceneProject({
      nodes: [{ id: 'mesh', name: 'Mesh', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
      animations: [{ id: 'mesh:10', nodeId: 'mesh', frame: 10, transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }],
    })
    expect(scene.animations[0].tracks[0].keyframes[0].frame).toBe(10)
    const keyed = upsertTransformKeyframe(scene, scene.nodes[0], 0)
    expect(evaluateSceneAtFrame(keyed, 5, keyed.nodes)[0].position[0]).toBe(5)
  })
})
