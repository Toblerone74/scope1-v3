/**
 * Browser-side client for the EPA CAMPD (Clean Air Markets Program Data) API.
 * Fetches hourly CEMS emissions data for a given facility.
 */

const BASE_URL = 'https://api.epa.gov/easey/streaming-services/emissions/apportioned/hourly'

/**
 * Process raw EPA records into normalized data points.
 */
function processRecords(records, capacityMw) {
  return records
    .filter(r => r.grossLoad > 0 && r.heatInput > 0)
    .map(r => ({
      date: r.date,
      hour: r.hour,
      gross_load: r.grossLoad,
      heat_input: r.heatInput,
      capacity_factor: capacityMw > 0 ? r.grossLoad / capacityMw : 0,
      heat_rate: r.grossLoad > 0 ? (r.heatInput * 1000) / r.grossLoad : 0,
      so2_mass: r.so2Mass || 0,
      nox_mass: r.noxMass || 0,
      co2_mass: r.co2Mass || 0,
    }))
}

/**
 * Fetch hourly emissions data from EPA CAMPD API.
 * @param {string|number} orisCode - Facility ORIS code
 * @param {number} capacityMw - Plant capacity in MW (for capacity factor calculation)
 * @param {number} startYear - Start year (default 2019)
 * @param {number} endYear - End year (default 2024)
 * @returns {Promise<Array>} Processed hourly data points
 */
export async function fetchHourlyEmissions(orisCode, capacityMw, startYear = 2019, endYear = 2024) {
  const params = new URLSearchParams({
    facilityId: String(orisCode),
    beginDate: `${startYear}-01-01`,
    endDate: `${endYear}-12-31`,
    operatingHoursOnly: 'true',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000) // 90s timeout

  try {
    const response = await fetch(`${BASE_URL}?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })

    clearTimeout(timer)

    if (!response.ok) {
      throw new Error(`EPA API error: ${response.status} ${response.statusText}`)
    }

    const records = await response.json()

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('No emissions data found for this facility and date range.')
    }

    return processRecords(records, capacityMw)
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('EPA API request timed out (90s). Try a shorter date range.')
    }
    throw err
  }
}
