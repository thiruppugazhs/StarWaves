import { useRef, useState } from 'react'
import {
  Check,
  Download,
  Upload,
  RotateCcw,
  Palette,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Type,
  Maximize2,
  Layout,
  Layers,
  Zap,
} from 'lucide-react'
import { PageHeader, SectionHeading } from '../components/ui'
import {
  useThemeCustomizer,
  PALETTE_GROUPS,
  getPresetsByPalette,
  COLOR_VARIABLE_GROUPS,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  DENSITY_OPTIONS,
  ELEVATION_OPTIONS,
  MOTION_OPTIONS,
} from '../themes'

export function ThemesPage() {
  const {
    activePreset,
    currentColors,
    fontFamily,
    radius,
    density,
    elevation,
    motion,
    isSaved,
    selectPreset,
    updateColor,
    updateOption,
    saveCustomTheme,
    resetToDefault,
    exportTheme,
    importTheme,
  } = useThemeCustomizer()

  const fileInputRef = useRef(null)
  const [activeCategory, setActiveCategory] = useState('all')

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result)
        importTheme(parsed)
      } catch {
        alert('Invalid UI/UX configuration JSON file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const triggerImport = () => {
    fileInputRef.current?.click()
  }

  return (
    <section className="themes-page">
      <PageHeader
        eyebrow="Account"
        title="UI & UX Customization Studio"
        actions={
          <div className="themes-header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetToDefault}
              title="Reset UI/UX settings to system defaults"
            >
              <RotateCcw size={15} />
              Reset Defaults
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={exportTheme}
              title="Export full UI/UX configuration JSON"
            >
              <Download size={15} />
              Export JSON
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={triggerImport}
              title="Import full UI/UX configuration JSON"
            >
              <Upload size={15} />
              Import JSON
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="primary-button theme-save-btn"
              onClick={saveCustomTheme}
            >
              {isSaved ? (
                <>
                  <Check size={16} /> Saved!
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Save Studio Preset
                </>
              )}
            </button>
          </div>
        }
      />

      {/* 1. Presets */}
      <div className="themes-section">
        <SectionHeading
          title="1. Theme Presets"
          description="Curated presets grouped by palette — 10 Monochrome and 12 vibrant Two-Color duotone themes, each strictly two-color (neutral canvas + one accent hue)."
        />
        {PALETTE_GROUPS.map((group) => {
          const presets = getPresetsByPalette(group.id)

          return (
            <div key={group.id} className="presets-group">
              <div className="presets-group-heading">
                <h3>{group.label}</h3>
                <span className="presets-group-count">{presets.length} presets</span>
              </div>
              <p className="presets-group-desc">{group.description}</p>
              <div className="presets-grid">
                {presets.map((preset) => {
                  const isActive = activePreset === preset.id
                  const bg = preset.colors['--bg-primary'] || '#121212'
                  const cardBg = preset.colors['--bg-card'] || '#1e1e1e'
                  const primaryColor = preset.colors['--color-primary'] || '#ffffff'
                  const textColor = preset.colors['--text-primary'] || '#ffffff'

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-card ${isActive ? 'active' : ''}`}
                      onClick={() => selectPreset(preset.id)}
                    >
                      <div
                        className="preset-preview-box"
                        style={{ backgroundColor: bg, borderColor: preset.colors['--border-color'] }}
                      >
                        <div
                          className="preset-mini-card"
                          style={{ backgroundColor: cardBg, color: textColor }}
                        >
                          <span
                            className="preset-mini-dot"
                            style={{ backgroundColor: primaryColor }}
                          />
                          <span className="preset-mini-text" style={{ color: textColor }}>
                            {preset.name}
                          </span>
                        </div>
                      </div>
                      <div className="preset-info">
                        <div className="preset-title-row">
                          <strong>{preset.name}</strong>
                          {isActive && <Check size={15} className="preset-check" />}
                        </div>
                        <small>{preset.description}</small>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 2. Interface Geometry & UX Controls */}
      <div className="themes-section">
        <SectionHeading
          title="2. Interface Geometry, Motion & UX"
          description="Control font families, corner roundness, layout density, elevation depth, and motion speeds."
        />

        <div className="ux-controls-grid">
          {/* Typography */}
          <div className="ux-control-card">
            <div className="ux-card-header">
              <Type size={18} />
              <div>
                <h3>Typography &amp; Font Family</h3>
                <small>Select the global font face across all pages.</small>
              </div>
            </div>
            <select
              className="ux-select-input"
              value={fontFamily}
              onChange={(e) => updateOption('fontFamily', e.target.value)}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Corner Radius */}
          <div className="ux-control-card">
            <div className="ux-card-header">
              <Maximize2 size={18} />
              <div>
                <h3>Corner Roundness (Border Radius)</h3>
                <small>Set corner roundness for cards, inputs, and buttons.</small>
              </div>
            </div>
            <div className="ux-segment-group">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`ux-segment-btn ${radius === r.id ? 'active' : ''}`}
                  onClick={() => updateOption('radius', r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* Layout Density */}
          <div className="ux-control-card">
            <div className="ux-card-header">
              <Layout size={18} />
              <div>
                <h3>Layout Density &amp; Spacing</h3>
                <small>Adjust padding and vertical margins.</small>
              </div>
            </div>
            <div className="ux-segment-group">
              {DENSITY_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`ux-segment-btn ${density === d.id ? 'active' : ''}`}
                  onClick={() => updateOption('density', d.id)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Elevation Depth */}
          <div className="ux-control-card">
            <div className="ux-card-header">
              <Layers size={18} />
              <div>
                <h3>Shadow &amp; Elevation Depth</h3>
                <small>Set 3D drop-shadow and container depth levels.</small>
              </div>
            </div>
            <div className="ux-segment-group">
              {ELEVATION_OPTIONS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`ux-segment-btn ${elevation === e.id ? 'active' : ''}`}
                  onClick={() => updateOption('elevation', e.id)}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>

          {/* Motion & Speed */}
          <div className="ux-control-card">
            <div className="ux-card-header">
              <Zap size={18} />
              <div>
                <h3>Animation Speed &amp; Micro-Motion</h3>
                <small>Control hover transitions and animation timing.</small>
              </div>
            </div>
            <div className="ux-segment-group">
              {MOTION_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ux-segment-btn ${motion === m.id ? 'active' : ''}`}
                  onClick={() => updateOption('motion', m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Preview */}
      <div className="themes-section">
        <SectionHeading
          title="3. Live Interface Preview"
          description="Real-time view of your typography, corner roundness, shadows, motion, and colors."
        />

        <div className="live-preview-container">
          <div className="preview-header-bar">
            <div className="preview-nav-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <span className="preview-title">StarWaves Real-Time Studio Preview</span>
          </div>

          <div className="preview-body">
            <div className="preview-sidebar">
              <div className="preview-logo">
                <Palette size={16} /> StarWaves
              </div>
              <div className="preview-nav-item active">Dashboard</div>
              <div className="preview-nav-item">Projects</div>
              <div className="preview-nav-item">Documents</div>
              <div className="preview-nav-item">Settings</div>
            </div>

            <div className="preview-main">
              <div className="preview-card-grid">
                <div className="preview-card">
                  <h3>Project Overview</h3>
                  <p>All colors, typography, corners, and elevation update dynamically.</p>
                  <div className="preview-btn-group">
                    <button type="button" className="preview-primary-btn">
                      Primary Action
                    </button>
                    <button type="button" className="preview-secondary-btn">
                      Secondary Action
                    </button>
                  </div>
                </div>

                <div className="preview-card">
                  <h3>Status Badges</h3>
                  <div className="preview-badge-stack">
                    <span className="preview-badge badge-success">
                      <CheckCircle2 size={12} /> Active
                    </span>
                    <span className="preview-badge badge-warning">
                      <AlertTriangle size={12} /> Pending
                    </span>
                    <span className="preview-badge badge-danger">
                      <XCircle size={12} /> Critical
                    </span>
                    <span className="preview-badge badge-purple">
                      <Tag size={12} /> Feature
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Color Controls */}
      <div className="themes-section">
        <SectionHeading
          title="4. Customize All Element Colors"
          description="Fine-tune Hex/RGB colors for backgrounds, cards, typography, buttons, borders, and status tags."
        />

        <div className="color-category-tabs">
          <button
            type="button"
            className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All Elements
          </button>
          {COLOR_VARIABLE_GROUPS.map((group, idx) => (
            <button
              key={group.title}
              type="button"
              className={`category-tab ${activeCategory === idx ? 'active' : ''}`}
              onClick={() => setActiveCategory(idx)}
            >
              {group.title}
            </button>
          ))}
        </div>

        <div className="color-groups-stack">
          {COLOR_VARIABLE_GROUPS.map((group, groupIdx) => {
            if (activeCategory !== 'all' && activeCategory !== groupIdx) return null

            return (
              <div key={group.title} className="color-group-card">
                <h3>{group.title}</h3>
                <div className="color-pickers-grid">
                  {group.variables.map((item) => {
                    const currentColor = currentColors[item.key] || '#888888'

                    return (
                      <div key={item.key} className="color-picker-item">
                        <div className="picker-label-col">
                          <label htmlFor={`color-${item.key}`}>{item.label}</label>
                          <code>{item.key}</code>
                        </div>

                        <div className="picker-input-controls">
                          <div
                            className="color-swatch-box"
                            style={{ backgroundColor: currentColor }}
                          />
                          <input
                            type="color"
                            id={`color-${item.key}`}
                            className="color-native-input"
                            value={currentColor.length === 7 ? currentColor : '#888888'}
                            onChange={(e) => updateColor(item.key, e.target.value)}
                          />
                          <input
                            type="text"
                            className="color-hex-input"
                            value={currentColor}
                            onChange={(e) => updateColor(item.key, e.target.value)}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

