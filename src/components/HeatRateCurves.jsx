import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, ComposedChart, Legend
} from 'recharts'

export default function HeatRateCurves({ result }) {
  if (!result) return null

  const { scatterData, curves, thresholds } = result

  // Generate curve lines for overlay
  const curveLines = useMemo(() => {
    const lines = []
    const step = 0.01

    // Ramping curve
    if (curves.ramping) {
      const [c2, c1, c0] = curves.ramping.coeffs
      for (let cf = thresholds.off_max_cf; cf <= thresholds.ramping_max_cf; cf += step) {
        const hr = c2 * cf * cf + c1 * cf + c0
        if (hr > 0 && hr < 30000) {
          lines.push({ cf: Math.round(cf * 1000) / 1000, rampingHr: Math.round(hr), onHr: null })
        }
      }
    }

    // On curve
    if (curves.on) {
      const [c2, c1, c0] = curves.on.coeffs
      for (let cf = thresholds.ramping_max_cf; cf <= 1.0; cf += step) {
        const hr = c2 * cf * cf + c1 * cf + c0
        if (hr > 0 && hr < 30000) {
          lines.push({ cf: Math.round(cf * 1000) / 1000, rampingHr: null, onHr: Math.round(hr) })
        }
      }
    }

    return lines
  }, [curves, thresholds])

  // Separate scatter data by state
  const rampingScatter = scatterData.filter(d => d.state === 'ramping')
  const onScatter = scatterData.filter(d => d.state === 'on')

  // Combine all data for the composed chart
  const allData = useMemo(() => {
    const combined = []
    rampingScatter.forEach(d => combined.push({ cf: d.cf, rampingScatter: d.hr }))
    onScatter.forEach(d => combined.push({ cf: d.cf, onScatter: d.hr }))
    curveLines.forEach(d => combined.push(d))
    return combined.sort((a, b) => a.cf - b.cf)
  }, [rampingScatter, onScatter, curveLines])

  return (
    <div className="heat-rate-curves">
      <h3>Heat Rate vs Capacity Factor</h3>
      <p className="chart-subtitle">
        2nd-order polynomial fit · Thresholds: Off ≤ {(thresholds.off_max_cf * 100).toFixed(0)}% CF,
        Ramping ≤ {(thresholds.ramping_max_cf * 100).toFixed(0)}% CF
      </p>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3e" />
            <XAxis
              dataKey="cf"
              type="number"
              domain={[0, 1]}
              name="Capacity Factor"
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              label={{ value: 'Capacity Factor (%)', position: 'bottom', offset: 15, fill: '#8a8f9e' }}
              stroke="#8a8f9e"
            />
            <YAxis
              dataKey="hr"
              type="number"
              name="Heat Rate"
              label={{ value: 'Heat Rate (Btu/kWh)', angle: -90, position: 'insideLeft', offset: -5, fill: '#8a8f9e' }}
              stroke="#8a8f9e"
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload || !payload.length) return null
                const d = payload[0].payload
                return (
                  <div className="custom-tooltip">
                    <p>CF: {(d.cf * 100).toFixed(1)}%</p>
                    <p>HR: {(d.hr || d.rampingScatter || d.onScatter || 0).toLocaleString()} Btu/kWh</p>
                  </div>
                )
              }}
            />
            <Scatter data={rampingScatter} fill="#e5a33d" opacity={0.4} name="Ramping" />
            <Scatter data={onScatter} fill="#2ba784" opacity={0.4} name="On-State" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Curve equations */}
      <div className="curve-equations">
        {curves.ramping && (
          <div className="equation-card ramping">
            <h4>Ramping Curve</h4>
            <p className="equation">
              HR = {curves.ramping.coeffs[0].toFixed(2)}·CF² + {curves.ramping.coeffs[1].toFixed(2)}·CF + {curves.ramping.coeffs[2].toFixed(2)}
            </p>
            <p className="stats">R² = {curves.ramping.r2.toFixed(3)} · n = {curves.ramping.n.toLocaleString()}</p>
          </div>
        )}
        {curves.on && (
          <div className="equation-card on">
            <h4>On-State Curve</h4>
            <p className="equation">
              HR = {curves.on.coeffs[0].toFixed(2)}·CF² + {curves.on.coeffs[1].toFixed(2)}·CF + {curves.on.coeffs[2].toFixed(2)}
            </p>
            <p className="stats">R² = {curves.on.r2.toFixed(3)} · n = {curves.on.n.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  )
}
