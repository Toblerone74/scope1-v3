import { useState, useCallback } from 'react'
import { evaluateHeatRate } from '../lib/regression'

export default function EmissionsCalculator({ result, onResults }) {
  const [csvData, setCsvData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState(null)

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target.result
        const lines = text.trim().split('\n')
        if (lines.length < 2) {
          setParseError('CSV must have a header row and at least one data row.')
          return
        }

        const header = lines[0].toLowerCase()
        // Try to find the generation/MW column
        const cols = lines[0].split(',').map(c => c.trim())
        let mwIdx = cols.findIndex(c =>
          /generation|gross.?load|mw|output|power/i.test(c)
        )
        let dateIdx = cols.findIndex(c => /date|time|hour|timestamp/i.test(c))

        if (mwIdx === -1) {
          // Assume first numeric column is MW
          mwIdx = 0
          if (dateIdx === 0) mwIdx = 1
        }

        const rows = []
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(c => c.trim())
          const mw = parseFloat(parts[mwIdx])
          if (!isNaN(mw) && mw >= 0) {
            rows.push({
              hour: i,
              date: dateIdx >= 0 ? parts[dateIdx] : `Hour ${i}`,
              generation_mw: mw,
            })
          }
        }

        if (rows.length === 0) {
          setParseError('No valid generation data found. Ensure CSV has numeric MW values.')
          return
        }

        setCsvData(rows)
      } catch (err) {
        setParseError('Failed to parse CSV: ' + err.message)
      }
    }
    reader.readAsText(file)
  }, [])

  const calculateEmissions = useCallback(() => {
    if (!csvData || !result) return

    const { thresholds, curves, factors, facility } = result
    const capacityMw = facility.capacity_mw
    const thresholdArr = [thresholds.off_max_cf, thresholds.ramping_max_cf]

    const hourly = csvData.map(row => {
      const mw = row.generation_mw
      const cf = capacityMw > 0 ? mw / capacityMw : 0

      // Determine operating state
      let state = 'off'
      if (cf > thresholds.off_max_cf && cf <= thresholds.ramping_max_cf) state = 'ramping'
      else if (cf > thresholds.ramping_max_cf) state = 'on'

      // Calculate heat rate from fitted curves
      const heatRate = evaluateHeatRate(cf, thresholdArr, curves)

      // Heat input = HR (Btu/kWh) * MW * 1000 kW/MW / 1e6 (to get MMBtu)
      const heatInput = state === 'off' ? 0 : (heatRate * mw * 1000) / 1e6

      // Emissions = heat input (MMBtu) * factor (lbs/MMBtu)
      const co2 = heatInput * factors.co2
      const so2 = heatInput * factors.so2
      const nox = heatInput * factors.nox

      return {
        hour: row.hour,
        date: row.date,
        generation_mw: mw,
        capacity_factor: cf,
        state,
        heat_rate: Math.round(heatRate),
        heat_input: Math.round(heatInput * 100) / 100,
        co2_lbs: Math.round(co2 * 100) / 100,
        so2_lbs: Math.round(so2 * 10000) / 10000,
        nox_lbs: Math.round(nox * 10000) / 10000,
      }
    })

    // Summary statistics
    const totalMwh = hourly.reduce((s, h) => s + h.generation_mw, 0)
    const totalCo2 = hourly.reduce((s, h) => s + h.co2_lbs, 0)
    const totalSo2 = hourly.reduce((s, h) => s + h.so2_lbs, 0)
    const totalNox = hourly.reduce((s, h) => s + h.nox_lbs, 0)

    const offHours = hourly.filter(h => h.state === 'off').length
    const rampHours = hourly.filter(h => h.state === 'ramping').length
    const onHours = hourly.filter(h => h.state === 'on').length

    onResults({
      hourly,
      summary: {
        total_hours: hourly.length,
        total_mwh: Math.round(totalMwh),
        total_co2_lbs: Math.round(totalCo2),
        total_co2_tons: Math.round(totalCo2 / 2000 * 100) / 100,
        total_so2_lbs: Math.round(totalSo2 * 100) / 100,
        total_nox_lbs: Math.round(totalNox * 100) / 100,
        avg_co2_rate: totalMwh > 0 ? Math.round(totalCo2 / totalMwh) : 0,
        off_hours: offHours,
        ramping_hours: rampHours,
        on_hours: onHours,
      },
    })
  }, [csvData, result, onResults])

  return (
    <div className="emissions-calculator">
      <h3>Calculate Emissions</h3>
      <p className="description">
        Upload a CSV with hourly generation data (MW) to calculate marginal emissions
        using the fitted heat-rate curves.
      </p>

      <div className="upload-area">
        <label className="file-upload">
          <input type="file" accept=".csv" onChange={handleFileUpload} />
          <span className="upload-text">
            {fileName || 'Choose CSV file...'}
          </span>
        </label>
        <p className="upload-hint">
          CSV should contain hourly generation in MW. We'll auto-detect the column.
        </p>
      </div>

      {parseError && <div className="error-text">{parseError}</div>}

      {csvData && (
        <div className="csv-preview">
          <p>{csvData.length} hours of generation data loaded</p>
          <p className="preview-range">
            Range: {csvData[0].generation_mw.toFixed(1)} MW — {Math.max(...csvData.map(d => d.generation_mw)).toFixed(1)} MW
          </p>
          <button className="btn-primary" onClick={calculateEmissions}>
            Calculate Emissions
          </button>
        </div>
      )}
    </div>
  )
}
