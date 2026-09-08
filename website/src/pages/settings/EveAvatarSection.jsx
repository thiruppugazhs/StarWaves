import { useEffect, useRef, useState } from 'react'
import { Bot, Eye, Orbit, RotateCcw, Upload, Trash2, Monitor, Smartphone, GlassWater, Sparkles } from 'lucide-react'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { SettingsCard } from '../../components/ui/SettingsCard'
import { SettingsSection } from '../../components/ui/SettingsSection'
import { EveInlineAvatar } from '../../components/eve/avatar/EveInlineAvatar'
import { AVATAR_CATALOG, AVATAR_LIMITS, AVATAR_RENDERERS } from '../../components/eve/avatar/avatarConstants'
import { useEveAvatar } from '../../components/eve/avatar/EveAvatarProvider'
import { getAvatarPreferences, listAvatarModels, saveAvatarPreferences, uploadAvatarModel, deleteAvatarModel } from '../../lib/eveAvatarApi'
import { useThemeCustomizer } from '../../hooks/useThemeCustomizer'

const RENDERER_OPTIONS = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'vrm', label: '3D VRM' },
  { value: 'live2d', label: 'Live2D (Cubism)' },
]

const MOTION_OPTIONS = [
  { value: 'auto', label: 'Auto (respect OS)' },
  { value: 'on', label: 'On' },
  { value: 'reduced', label: 'Reduced' },
]

const SAVE_MESSAGE_TIMEOUT_MS = 2200
const UPLOAD_MESSAGE_TIMEOUT_MS = 2500
const SCALE_SAVE_DEBOUNCE_MS = 350

export function EveAvatarSection() {
  const { prefs, setPrefs, activeModel } = useEveAvatar()
  const { activePreset } = useThemeCustomizer() || {}
  const activePresetId = activePreset
  const [remoteModels, setRemoteModels] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const scaleSaveTimeoutRef = useRef(0)
  const zoomSaveTimeoutRef = useRef(0)
  const [viewResetKey, setViewResetKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [prefRes, modelRes] = await Promise.all([
          getAvatarPreferences().catch(() => null),
          listAvatarModels().catch(() => null),
        ])
        if (cancelled) return
        if (prefRes?.preferences) setPrefs(prefRes.preferences)
        if (modelRes?.models) setRemoteModels(modelRes.models)
      } catch {
        if (!cancelled) setError('Could not load avatar settings.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [setPrefs])

  useEffect(() => () => {
    window.clearTimeout(scaleSaveTimeoutRef.current)
    window.clearTimeout(zoomSaveTimeoutRef.current)
  }, [])

  const persist = async (patch) => {
    setBusy(true)
    setError('')
    setMessage('')
    const next = { ...prefs, ...patch }
    setPrefs(next)
    try {
      const res = await saveAvatarPreferences(next)
      if (res?.preferences) setPrefs(res.preferences)
      setMessage('Avatar preferences saved.')
      setTimeout(() => setMessage(''), SAVE_MESSAGE_TIMEOUT_MS)
    } catch (err) {
      setError(err?.message || 'Could not save preferences.')
    } finally {
      setBusy(false)
    }
  }

  const persistScale = (scale) => {
    const next = { ...prefs, scale }
    setPrefs(next)
    setError('')
    window.clearTimeout(scaleSaveTimeoutRef.current)
    scaleSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await saveAvatarPreferences(next)
        if (res?.preferences) setPrefs(res.preferences)
        setMessage('Avatar preferences saved.')
        setTimeout(() => setMessage(''), SAVE_MESSAGE_TIMEOUT_MS)
      } catch (err) {
        setError(err?.message || 'Could not save preferences.')
      }
    }, SCALE_SAVE_DEBOUNCE_MS)
  }

  const persistZoom = (zoom) => {
    const next = { ...prefs, zoom }
    setPrefs(next)
    setError('')
    window.clearTimeout(zoomSaveTimeoutRef.current)
    zoomSaveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await saveAvatarPreferences(next)
        if (res?.preferences) setPrefs(res.preferences)
        setMessage('Avatar preferences saved.')
        setTimeout(() => setMessage(''), SAVE_MESSAGE_TIMEOUT_MS)
      } catch (err) {
        setError(err?.message || 'Could not save preferences.')
      }
    }, SCALE_SAVE_DEBOUNCE_MS)
  }

  const handleResetView = () => {
    setViewResetKey((key) => key + 1)
    persist({ zoom: 1 })
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const ext = `.${file.name.split('.').pop().toLowerCase()}`
    const allowed = ['.vrm', '.glb', '.gltf', '.zip', '.json']
    if (!allowed.some((a) => ext === a || file.name.toLowerCase().endsWith('.model3.json'))) {
      setError(`Unsupported file type ${ext} — use .vrm, .glb, .model3.json or .zip`)
      event.target.value = ''
      return
    }
    if (file.size > AVATAR_LIMITS.UPLOAD_MAX_BYTES) {
      setError('File too large — max 12MB.')
      event.target.value = ''
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await uploadAvatarModel(file)
      const pref = res?.preferences || res
      if (pref?.modelId) setPrefs((current) => ({ ...current, modelId: pref.modelId, modelUrl: pref.modelUrl || pref.url || null }))
      if (res?.preferences) setPrefs(res.preferences)
      const models = await listAvatarModels().catch(() => null)
      if (models?.models) setRemoteModels(models.models)
      setMessage(`Uploaded ${file.name} — validated.`)
      setTimeout(() => setMessage(''), UPLOAD_MESSAGE_TIMEOUT_MS)
    } catch (err) {
      setError(err?.message || 'Upload failed — check file and try again.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (modelId) => {
    if (!modelId?.startsWith('upload:')) return
    setBusy(true)
    setError('')
    try {
      await deleteAvatarModel(modelId)
      setPrefs((current) => ({ ...current, modelId: AVATAR_CATALOG[0].id, modelUrl: null }))
      const models = await listAvatarModels().catch(() => null)
      if (models?.models) setRemoteModels(models.models)
      setMessage('Uploaded model deleted.')
    } catch (err) {
      setError(err?.message || 'Could not delete model.')
    } finally { setBusy(false) }
  }

  const allModels = [...AVATAR_CATALOG, ...remoteModels.filter((m) => !AVATAR_CATALOG.some((c) => c.id === m.id))]

  return (
    <SettingsSection
      id="settings-eve-avatar"
      title="Eve Avatar (Live2D / 3D)"
      description="Global floating companion + inline avatar on Eve pages. Auto picks 3D VRM on desktop and Live2D on mobile, or choose manually. Upload your own .vrm / .glb / .model3.json (.zip)."
    >
      <SettingsCard
        icon={<Bot size={16} />}
        title="Avatar presence"
        description="Toggle everywhere vs inline only. Global dock is draggable — drag the header pill."
        actions={
          <label className="eve-avatar-toggle">
            <input type="checkbox" checked={prefs?.enabled !== false} onChange={(e) => persist({ enabled: e.target.checked })} disabled={busy} />
            <span>{prefs?.enabled !== false ? 'Enabled' : 'Disabled'}</span>
          </label>
        }
      >
        <div className="eve-avatar-preview-grid">
          <EveInlineAvatar
            size="md"
            presetId={activePresetId}
            prefs={prefs}
            activeModel={activeModel}
            isEveSpeaking={false}
            isEveThinking={false}
            resetViewSignal={viewResetKey}
          />
          <div className="eve-avatar-controls">
            <div className="form-row">
              <label className="form-label">Renderer</label>
              <CustomDropdown
                options={RENDERER_OPTIONS}
                value={prefs?.renderer || 'auto'}
                onChange={(val) => persist({ renderer: val })}
                placeholder="Auto"
              />
              <small className="form-hint">Auto uses WebGL2 + memory probe. Live2D lighter on Android.</small>
            </div>
            <div className="form-row">
              <label className="form-label">Motion</label>
              <CustomDropdown
                options={MOTION_OPTIONS}
                value={prefs?.motion || 'auto'}
                onChange={(val) => persist({ motion: val })}
                placeholder="Auto"
              />
              <small className="form-hint">Auto respects prefers-reduced-motion. Reduced disables mouth/eye follow.</small>
            </div>
            <div className="form-row form-row-inline">
              <label className="form-label">Scale</label>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={prefs?.scale ?? 1}
                onChange={(e) => persistScale(Number(e.target.value))}
                disabled={busy}
                aria-label="Avatar scale"
              />
              <span className="form-value">{(prefs?.scale ?? 1).toFixed(2)}×</span>
            </div>
            <div className="form-row form-row-inline">
              <label className="form-label">Zoom</label>
              <input
                type="range"
                min="0.3"
                max="3"
                step="0.05"
                value={prefs?.zoom ?? 1}
                onChange={(e) => persistZoom(Number(e.target.value))}
                disabled={busy}
                aria-label="Model zoom"
              />
              <span className="form-value">{(prefs?.zoom ?? 1).toFixed(2)}×</span>
            </div>
            <div className="form-row form-row-inline">
              <label className="checkbox-row">
                <input type="checkbox" checked={prefs?.autoRotate === true} onChange={(e) => persist({ autoRotate: e.target.checked })} disabled={busy} />
                <Orbit size={14} /> Auto-rotate
              </label>
              <button type="button" className="eve-avatar-model-delete" onClick={handleResetView} disabled={busy} title="Straighten the model and reset zoom">
                <RotateCcw size={12} /> Reset view
              </button>
            </div>
            <div className="form-row form-row-inline">
              <label className="checkbox-row">
                <input type="checkbox" checked={prefs?.inlineEnabled !== false} onChange={(e) => persist({ inlineEnabled: e.target.checked })} disabled={busy} />
                <Eye size={14} /> Inline on Eve pages
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={prefs?.docked !== false} onChange={(e) => persist({ docked: e.target.checked })} disabled={busy} />
                <Monitor size={14} /> Global dock
              </label>
            </div>
          </div>
        </div>
        {(message || error) && (
          <div className={`eve-avatar-banner ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
            {error || message}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<Sparkles size={16} />}
        title="Example models"
        description="Bundled CC0 examples. Pick one — auto applies renderer."
      >
        <div className="eve-avatar-model-grid">
          {allModels.map((model) => {
            const active = (prefs?.modelId || activeModel?.id) === model.id
            const selectModel = () => persist({ modelId: model.id, modelUrl: model.url || null, renderer: model.renderer === 'live2d' ? AVATAR_RENDERERS.LIVE2D : model.renderer === 'vrm' ? AVATAR_RENDERERS.VRM : undefined })
            return (
              <div key={model.id} className={`eve-avatar-model-card ${active ? 'is-active' : ''}`}>
                <button
                  type="button"
                  className="eve-avatar-model-select"
                  onClick={selectModel}
                  disabled={busy}
                  aria-pressed={active}
                  aria-label={`Use ${model.label}`}
                >
                  <span className="eve-avatar-model-head">
                    <span className="eve-avatar-model-thumb" aria-hidden="true"><GlassWater size={18} /></span>
                    <span className="eve-avatar-model-label" title={model.label}>{model.label}</span>
                  </span>
                  <small className="eve-avatar-model-meta">{model.renderer} • {model.id.startsWith('upload:') ? 'uploaded' : 'example'}</small>
                  <small className="eve-avatar-model-attrib">{model.attribution}</small>
                </button>
                {model.id.startsWith('upload:') ? (
                  <button type="button" className="eve-avatar-model-delete" onClick={() => handleDelete(model.id)} disabled={busy} title={`Delete ${model.label}`}>
                    <Trash2 size={12} /> Delete
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Upload size={16} />}
        title="Upload model"
        description="Validate .vrm / .glb / .model3.json / .zip (max 12MB, zip must contain one model3.json). Stored per-user in workspace storage."
      >
        <div className="eve-avatar-upload-row">
          <input ref={fileRef} type="file" accept=".vrm,.glb,.gltf,.json,.zip,model3.json" onChange={handleUpload} disabled={busy} aria-label="Upload avatar model" />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={14} /> Choose file
          </button>
          <span className="form-hint"><Smartphone size={12} /> Mobile + Tauri both support upload.</span>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
