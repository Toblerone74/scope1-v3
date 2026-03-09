import { useState, useCallback, useEffect } from 'react'
import FacilitySearch from './components/FacilitySearch'
import AnalysisPanel from './components/AnalysisPanel'
import HeatRateCurves from './components/HeatRateCurves'
import EmissionsCalculator from './components/EmissionsCalculator'
import ResultsPanel from './components/ResultsPanel'
import Methodology from './components/Methodology'
import { useAnalysis } from './hooks/useAnalysis'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'curves', label: 'Heat-Rate Curves' },
  { id: 'calculate', label: 'Calculate Emissions' },
  { id: 'results', label: 'Results' },
  { id: 'methodology', label: 'Methodology' },
]

export default function App() {
  const [facilities, setFacilities] = useState([])
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [emissions, setEmissions] = useState(null)

  const { result, loading, error, progress, runAnalysis, clearAnalysis } = useAnalysis()

  // Load facilities list
  useEffect(() => {
    import('./data/facilities.json').then(mod => {
      setFacilities(mod.default || mod)
    }).catch(() => {
      console.warn('facilities.json not found, using empty list')
      setFacilities([])
    })
  }, [])

  const handleSelectFacility = useCallback((fac) => {
    setSelectedFacility(fac)
    setEmissions(null)
    clearAnalysis()
    setActiveTab('overview')
  }, [clearAnalysis])

  const handleRunAnalysis = useCallback(() => {
    if (selectedFacility) {
      runAnalysis(selectedFacility)
    }
  }, [selectedFacility, runAnalysis])

  const handleEmissionsResults = useCallback((results) => {
    setEmissions(results)
    setActiveTab('results')
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1>Scope 1 Emissions Calculator</h1>
          <span className="version">v3</span>
        </div>
        <div className="header-subtitle">
          Marginal emissions analysis using EPA CAMPD hourly CEMS data
        </div>
        <div className="header-logo">Granular Energy</div>
      </header>

      <section className="search-section">
        <FacilitySearch
          facilities={facilities}
          onSelect={handleSelectFacility}
          disabled={loading}
        />
      </section>

      <section className="analysis-section">
        <AnalysisPanel
          facility={selectedFacility}
          onRun={handleRunAnalysis}
          loading={loading}
          progress={progress}
          error={error}
          result={result}
        />
      </section>

      {result && (
        <>
          <nav className="tab-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <main className="tab-content">
            {activeTab === 'overview' && (
              <div className="overview-tab">
                <h3>Plant Overview</h3>
                <div className="overview-grid">
                  <div className="overview-item">
                    <span className="label">Facility</span>
                    <span className="value">{result.facility.name}</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">State</span>
                    <span className="value">{result.facility.state}</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">Fuel Type</span>
                    <span className="value">{result.facility.fuel_type || 'Unknown'}</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">Capacity</span>
                    <span className="value">{result.facility.capacity_mw} MW</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">ORIS Code</span>
                    <span className="value">{result.facility.oris_id}</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">Data Points</span>
                    <span className="value">{result.metadata.total_hours.toLocaleString()}</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">Off Threshold</span>
                    <span className="value">{(result.thresholds.off_max_cf * 100).toFixed(1)}% CF</span>
                  </div>
                  <div className="overview-item">
                    <span className="label">Ramping Threshold</span>
                    <span className="value">{(result.thresholds.ramping_max_cf * 100).toFixed(1)}% CF</span>
                  </div>
                </div>

                <h4>Operating State Distribution</h4>
                <div className="state-bars">
                  <div className="state-bar">
                    <div className="bar-fill off" style={{ width: `${(result.metadata.off_hours / result.metadata.total_hours) * 100}%` }} />
                    <span>Off: {result.metadata.off_hours.toLocaleString()} hrs</span>
                  </div>
                  <div className="state-bar">
                    <div className="bar-fill ramping" style={{ width: `${(result.metadata.ramping_hours / result.metadata.total_hours) * 100}%` }} />
                    <span>Ramping: {result.metadata.ramping_hours.toLocaleString()} hrs</span>
                  </div>
                  <div className="state-bar">
                    <div className="bar-fill on" style={{ width: `${(result.metadata.on_hours / result.metadata.total_hours) * 100}%` }} />
                    <span>On: {result.metadata.on_hours.toLocaleString()} hrs</span>
                  </div>
                </div>

                <div className="emission-factors">
                  <h4>Emission Factors (lbs/MMBtu)</h4>
                  <div className="factors-row">
                    <span>CO₂: {result.factors.co2}</span>
                    <span>SO₂: {result.factors.so2}</span>
                    <span>NOₓ: {result.factors.nox}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'curves' && <HeatRateCurves result={result} />}

            {activeTab === 'calculate' && (
              <EmissionsCalculator result={result} onResults={handleEmissionsResults} />
            )}

            {activeTab === 'results' && (
              emissions
                ? <ResultsPanel emissions={emissions} />
                : <div className="empty-state"><p>Upload a CSV in the "Calculate Emissions" tab first.</p></div>
            )}

            {activeTab === 'methodology' && <Methodology />}
          </main>
        </>
      )}

      <footer className="app-footer">
        <p>
          Data: EPA CAMPD Hourly CEMS · Factors: EPA AP-42 / IPCC ·
          3-State Polynomial Model · © {new Date().getFullYear()} Granular Energy
        </p>
      </footer>
    </div>
  )
}
