import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

export default function ResultsPanel({ emissions }) {
  if (!emissions) return null

  const { hourly, summary } = emissions

  // Prepare chart data (show every Nth point if too many)
  const step = Math.max(1, Math.floor(hourly.length / 200))
  const chartData = hourly.filter((_, i) => i % step === 0).map(h => ({
    hour: h.hour,
    mw: h.generation_mw,
    co2: h.co2_lbs,
    hr: h.heat_rate,
  }))

  // State breakdown for bar chart
  const stateData = [
    { name: 'Off', hours: summary.off_hours, fill: '#555' },
    { name: 'Ramping', hours: summary.ramping_hours, fill: '#e5a33d' },
    { name: 'On', hours: summary.on_hours, fill: '#2ba784' },
  ]

  const handleExport = () => {
    const headers = 'Hour,Date,MW,CF,State,HeatRate,HeatInput_MMBtu,CO2_lbs,SO2_lbs,NOx_lbs\n'
    const rows = hourly.map(h =>
      `${h.hour},${h.date},${h.generation_mw},${h.capacity_factor.toFixed(4)},${h.state},${h.heat_rate},${h.heat_input},${h.co2_lbs},${h.so2_lbs},${h.nox_lbs}`
    ).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'emissions_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="results-panel">
      <div className="results-header">
        <h3>Emissions Results</h3>
        <button className="btn-secondary" onClick={handleExport}>Export CSV</button>
      </div>

      {/* Summary cards */}
      <div className="summary-cards">
        <div className="card">
          <span className="card-value">{summary.total_mwh.toLocaleString()}</span>
          <span className="card-label">Total MWh</span>
        </div>
        <div className="card highlight">
          <span className="card-value">{summary.total_co2_tons.toLocaleString()}</span>
          <span className="card-label">CO₂ (short tons)</span>
        </div>
        <div className="card">
          <span className="card-value">{summary.avg_co2_rate.toLocaleString()}</span>
          <span className="card-label">Avg CO₂ Rate (lbs/MWh)</span>
        </div>
        <div className="card">
          <span className="card-value">{summary.total_so2_lbs.toLocaleString()}</span>
          <span className="card-label">SO₂ (lbs)</span>
        </div>
        <div className="card">
          <span className="card-value">{summary.total_nox_lbs.toLocaleString()}</span>
          <span className="card-label">NOₓ (lbs)</span>
        </div>
        <div className="card">
          <span className="card-value">{summary.total_hours.toLocaleString()}</span>
          <span className="card-label">Total Hours</span>
        </div>
      </div>

      {/* Emissions time series */}
      <div className="chart-section">
        <h4>CO₂ Emissions Over Time</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
            <XAxis dataKey="hour" stroke="#8a8f9e" label={{ value: 'Hour', position: 'bottom', fill: '#8a8f9e' }} />
            <YAxis stroke="#8a8f9e" label={{ value: 'CO₂ (lbs)', angle: -90, position: 'insideLeft', fill: '#8a8f9e' }} />
            <Tooltip contentStyle={{ background: '#1e2330', border: '1px solid #2a2f3e', borderRadius: 6 }} />
            <Line type="monotone" dataKey="co2" stroke="#e5a33d" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* State breakdown */}
      <div className="chart-section">
        <h4>Operating State Breakdown</h4>
        <div className="state-breakdown">
          {stateData.map(s => (
            <div key={s.name} className="state-bar-item">
              <div className="state-label">
                <span className="state-dot" style={{ background: s.fill }} />
                {s.name}
              </div>
              <div className="state-count">{s.hours.toLocaleString()} hrs ({((s.hours / summary.total_hours) * 100).toFixed(1)}%)</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
