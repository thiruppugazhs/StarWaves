import { useCallback, useEffect, useReducer, useRef } from 'react'
import { evaluateSceneAtFrame } from './animationModel'

const INITIAL_STATE = {
  activeTool: 'select',
  selectedNodeId: null,
  currentFrame: 0,
  playing: false,
  activeClipId: null,
  showGrid: true,
  showAxes: true,
  browserOpen: true,
  inspectorOpen: true,
  timelineCollapsed: false,
  panelSizes: { browser: 260, inspector: 320, timeline: 210 },
  status: '',
  error: '',
  history: { past: [], future: [] },
}

function createState(scene) {
  return { ...INITIAL_STATE, scene, previewNodes: scene?.nodes || [], currentFrame: scene?.timeline?.currentFrame || 0, activeClipId: scene?.timeline?.activeClipId || null }
}

function withHistory(state, scene) {
  return {
    ...state,
    scene,
    previewNodes: evaluateSceneAtFrame(scene, state.currentFrame, scene.nodes),
    history: { past: [...state.history.past, state.scene], future: [] },
  }
}

export function editorReducer(state, action) {
  switch (action.type) {
    case 'replace-scene':
      return { ...createState(action.scene), activeTool: state.activeTool, showGrid: state.showGrid, showAxes: state.showAxes, browserOpen: state.browserOpen, inspectorOpen: state.inspectorOpen, panelSizes: state.panelSizes }
    case 'scene-change':
      return withHistory(state, action.scene)
    case 'select-node':
      return { ...state, selectedNodeId: action.nodeId }
    case 'set-tool':
      return { ...state, activeTool: action.tool }
    case 'set-frame':
      return { ...state, currentFrame: action.frame, previewNodes: evaluateSceneAtFrame(state.scene, action.frame, state.scene.nodes), scene: { ...state.scene, timeline: { ...state.scene.timeline, currentFrame: action.frame } } }
    case 'set-playing':
      return { ...state, playing: action.value }
    case 'set-clip':
      return { ...state, activeClipId: action.clipId, scene: { ...state.scene, timeline: { ...state.scene.timeline, activeClipId: action.clipId } }, previewNodes: evaluateSceneAtFrame({ ...state.scene, timeline: { ...state.scene.timeline, activeClipId: action.clipId } }, state.currentFrame, state.scene.nodes) }
    case 'toggle-grid':
      return { ...state, showGrid: !state.showGrid }
    case 'toggle-axes':
      return { ...state, showAxes: !state.showAxes }
    case 'toggle-browser':
      return { ...state, browserOpen: !state.browserOpen }
    case 'toggle-inspector':
      return { ...state, inspectorOpen: !state.inspectorOpen }
    case 'toggle-timeline':
      return { ...state, timelineCollapsed: !state.timelineCollapsed }
    case 'resize-panel':
      return { ...state, panelSizes: { ...state.panelSizes, [action.panel]: Math.max(action.min || 160, Math.min(action.max || 520, action.size)) } }
    case 'set-status':
      return { ...state, status: action.status }
    case 'set-error':
      return { ...state, error: action.error }
    case 'undo': {
      const previous = state.history.past.at(-1)
      if (!previous) return state
      return { ...state, scene: previous, previewNodes: evaluateSceneAtFrame(previous, state.currentFrame, previous.nodes), history: { past: state.history.past.slice(0, -1), future: [state.scene, ...state.history.future] } }
    }
    case 'redo': {
      const next = state.history.future[0]
      if (!next) return state
      return { ...state, scene: next, previewNodes: evaluateSceneAtFrame(next, state.currentFrame, next.nodes), history: { past: [...state.history.past, state.scene], future: state.history.future.slice(1) } }
    }
    default:
      return state
  }
}

export function useAvatarEditorState(scene, onSceneChange) {
  const [state, dispatch] = useReducer(editorReducer, scene, createState)
  const internalSceneChangeRef = useRef(false)

  useEffect(() => {
    if (internalSceneChangeRef.current) {
      internalSceneChangeRef.current = false
      return
    }
    dispatch({ type: 'replace-scene', scene })
  }, [scene])

  useEffect(() => {
    onSceneChange?.(state.scene)
  }, [onSceneChange, state.scene])

  const changeScene = useCallback((updater) => {
    const nextScene = typeof updater === 'function' ? updater(state.scene) : updater
    internalSceneChangeRef.current = true
    dispatch({ type: 'scene-change', scene: nextScene })
  }, [state.scene])

  return { state, dispatch, changeScene }
}
