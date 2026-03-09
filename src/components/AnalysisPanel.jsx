export default function AnalysisPanel({ facility, onRun, loading, progress, error, result }) {
  if (!facility) {
    return (
      <div className="analysis-panel empty">
        <div className="empty-state">
          <h3>Select a Facility</h3>
          <p>Search for and select a power plant above to begin analysis.</p>
          <p className="hint">
            We'll fetch hourly CEMS data from the EPA CAMPD API and fit
            polynomial heat-rate curves using the 3-state operating model.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="analysis-panel">
      <div className="facility-info">
        <h3>{facility.name}</h3>
        <div className="facility-details">
          <span>{facility.state}</span>
          <span>{facility.fuel_type || 'Unknown fuel'}</span>
          <span>{facility.capacity_mw} MW</span>
          <span>ORIS {facility.oris_id}</span>
        </div>
      </div>

      {!result && !loading && (
        <button className="btn-primary" onClick={onRun} disabled={loading}>
          Run Analysis
        </button>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>{progress || 'Analyzing...'}</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p className="error-text">{error}</p>
          <button className="btn-secondary" onClick={onRun}>
            Retry
          </button>
        </div>
      )}

      {result && (
        <div className="analysis-summary">
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Data Points</span>
              <span className="value">{result.metadata.total_hours.toLocaleString()}</span>
            </div>
            <div className="summary-item">
              <span className="label">Years</span>
              <span className="value">{result.metadata.start_year}–{result.metadata.end_year}</span>
            </div>
            <div className="summary-item">
              <span className="label">Ramping R²</span>
              <span className="value">
                {result.curves.ramping ? result.curves.ramping.r2.toFixed(3) : 'N/A'}
              </span>
            </div>
            <div className="summary-item">
              <span className="label">On-State R²</span>
              <span className="value">
                {result.curves.on ? result.curves.on.r2.toFixed(3) : 'N/A'}
              </span>
            </div>
          </div>
          {((result.curves.ramping && result.curves.ramping.r2 < 0.05) ||
            (result.curves.on && result.curves.on.r2 < 0.05)) && (
            <div className="warning-badge">
              ⚠ Low R² — heat-rate curves may have limited predictive power for this facility.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
