import { useState, useCallback } from 'react'
import { fetchHourlyEmissions } from '../lib/campdClient'
import { autoDetectThresholds, fitHeatRateCurves } from '../lib/regression'
import { getFactors } from '../lib/emissionFactors'

/**
 * Hook to manage facility analysis state.
 * Fetches CEMS data from EPA, runs polynomial regression, returns curves.
 */
export function useAnalysis() {
  const [facility, setFacility] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState('')

  const runAnalysis = useCallback(async (fac, startYear = 2019, endYear = 2024) => {
    setFacility(fac)
    setResult(null)
    setError(null)
    setLoading(true)
    setProgress('Fetching CEMS data from EPA...')

    try {
      const orisCode = String(fac.oris_id)
      const capacityMw = Number(fac.capacity_mw)
      const fuelType = fac.fuel_type || null

      // Step 1: Fetch hourly data from EPA CAMPD
      const hourlyData = await fetchHourlyEmissions(orisCode, capacityMw, startYear, endYear)

      if (hourlyData.length < 100) {
        throw new Error(`Insufficient data: only ${hourlyData.length} valid hours found (need 100+). Try a wider date range.`)
      }

      setProgress('Running regression analysis...')

      // Step 2: Auto-detect operating thresholds
      const [offMaxCf, rampingMaxCf] = autoDetectThresholds(hourlyData, fuelType)

      // Step 3: Fit polynomial curves
      const curveResults = fitHeatRateCurves(hourlyData, [offMaxCf, rampingMaxCf])

      // Step 4: Get emission factors
      const factors = getFactors(fuelType)

      // Count states
      const offCount = hourlyData.filter(d => d.capacity_factor <= offMaxCf).length
      const rampCount = hourlyData.filter(d => d.capacity_factor > offMaxCf && d.capacity_factor <= rampingMaxCf).length
      const onCount = hourlyData.filter(d => d.capacity_factor > rampingMaxCf).length

      const analysisResult = {
        facility: {
          oris_id: fac.oris_id,
          name: fac.name,
          state: fac.state,
          fuel_type: fuelType,
          capacity_mw: capacityMw,
        },
        thresholds: {
          off_max_cf: offMaxCf,
          ramping_max_cf: rampingMaxCf,
        },
        curves: {
          ramping: curveResults.ramping,
          on: curveResults.on,
        },
        factors,
        scatterData: curveResults.scatterData,
        metadata: {
          total_hours: hourlyData.length,
          off_hours: offCount,
          ramping_hours: rampCount,
          on_hours: onCount,
          start_year: startYear,
          end_year: endYear,
        },
      }

      setResult(analysisResult)
      setProgress('')
    } catch (err) {
      setError(err.message || 'Analysis failed')
      setProgress('')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearAnalysis = useCallback(() => {
    setFacility(null)
    setResult(null)
    setError(null)
    setProgress('')
  }, [])

  return { facility, result, loading, error, progress, runAnalysis, clearAnalysis }
}
