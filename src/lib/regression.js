/**
 * Pure JS polynomial regression for heat-rate curves.
 * Replaces numpy.polyfit with Cramer's rule for 2nd-order polynomials.
 */

// Fuel-type default ramping thresholds (capacity factor)
const RAMPING_DEFAULTS = {
  'coal st': 0.40, 'coal': 0.40, 'coal steam': 0.40,
  'natural gas cc': 0.30, 'gas cc': 0.30, 'combined cycle': 0.30,
  'natural gas gt': 0.25, 'gas gt': 0.25, 'gas turbine': 0.25,
  'oil st': 0.35, 'oil': 0.35, 'oil steam': 0.35,
}

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * 2nd-order polynomial fit using Cramer's rule on normal equations.
 * Returns [c2, c1, c0] where y = c2*x^2 + c1*x + c0
 */
function polyfit(x, y) {
  const n = x.length
  if (n < 3) return null

  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0
  let t0 = 0, t1 = 0, t2 = 0

  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i]
    const x2 = xi * xi, x3 = x2 * xi, x4 = x3 * xi
    s0 += 1; s1 += xi; s2 += x2; s3 += x3; s4 += x4
    t0 += yi; t1 += xi * yi; t2 += x2 * yi
  }

  // Normal equations: A * [c0, c1, c2]^T = B
  // | s0 s1 s2 | | c0 |   | t0 |
  // | s1 s2 s3 | | c1 | = | t1 |
  // | s2 s3 s4 | | c2 |   | t2 |

  const det = s0 * (s2 * s4 - s3 * s3)
            - s1 * (s1 * s4 - s3 * s2)
            + s2 * (s1 * s3 - s2 * s2)

  if (Math.abs(det) < 1e-12) return null

  const c0 = (t0 * (s2 * s4 - s3 * s3) - s1 * (t1 * s4 - s3 * t2) + s2 * (t1 * s3 - s2 * t2)) / det
  const c1 = (s0 * (t1 * s4 - s3 * t2) - t0 * (s1 * s4 - s3 * s2) + s2 * (s1 * t2 - t1 * s2)) / det
  const c2 = (s0 * (s2 * t2 - t1 * s3) - s1 * (s1 * t2 - t1 * s2) + t0 * (s1 * s3 - s2 * s2)) / det

  return [c2, c1, c0]
}

function polyval(coeffs, x) {
  return coeffs[0] * x * x + coeffs[1] * x + coeffs[2]
}

function rSquared(x, y, coeffs) {
  const yMean = mean(y)
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < x.length; i++) {
    const pred = polyval(coeffs, x[i])
    ssTot += (y[i] - yMean) ** 2
    ssRes += (y[i] - pred) ** 2
  }
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot
}

/**
 * Auto-detect operating state thresholds from data distribution.
 * Returns [offMaxCf, rampingMaxCf]
 */
export function autoDetectThresholds(data, fuelType) {
  const cfs = data.map(d => d.capacity_factor).filter(v => v > 0)
  if (cfs.length < 100) {
    const defaultRamp = fuelType
      ? (RAMPING_DEFAULTS[fuelType.toLowerCase()] || 0.30)
      : 0.30
    return [0.02, defaultRamp]
  }

  // Off threshold: 2nd percentile of CF distribution
  const offMaxCf = Math.max(0.02, percentile(cfs, 2))

  // Ramping threshold: try to find elbow, fallback to fuel default
  const defaultRamp = fuelType
    ? (RAMPING_DEFAULTS[fuelType.toLowerCase()] || 0.30)
    : 0.30

  // Simple elbow detection: sort by CF, look for where HR stabilizes
  const validPairs = data
    .filter(d => d.capacity_factor > offMaxCf && d.heat_rate > 0 && d.heat_rate < 30000)
    .sort((a, b) => a.capacity_factor - b.capacity_factor)

  if (validPairs.length < 50) return [offMaxCf, defaultRamp]

  // Split into bins and find where HR variance drops
  const binCount = 20
  const binSize = Math.ceil(validPairs.length / binCount)
  const bins = []
  for (let i = 0; i < binCount; i++) {
    const slice = validPairs.slice(i * binSize, (i + 1) * binSize)
    if (slice.length < 3) continue
    const hrs = slice.map(d => d.heat_rate)
    const hrMean = mean(hrs)
    const hrVar = hrs.reduce((s, v) => s + (v - hrMean) ** 2, 0) / hrs.length
    bins.push({
      cfMid: mean(slice.map(d => d.capacity_factor)),
      hrMean,
      hrVar,
      cv: hrMean > 0 ? Math.sqrt(hrVar) / hrMean : 0,
    })
  }

  // Find where coefficient of variation drops below median
  const cvs = bins.map(b => b.cv)
  const medianCv = percentile(cvs, 50)
  let rampingMaxCf = defaultRamp

  for (let i = 1; i < bins.length; i++) {
    if (bins[i].cv < medianCv && bins[i - 1].cv >= medianCv) {
      rampingMaxCf = bins[i].cfMid
      break
    }
  }

  // Clamp to reasonable range
  rampingMaxCf = Math.max(0.10, Math.min(0.60, rampingMaxCf))

  return [offMaxCf, rampingMaxCf]
}

/**
 * Fit heat-rate curves for ramping and on states.
 * Returns { ramping: { coeffs, r2, n }, on: { coeffs, r2, n }, scatterData }
 */
export function fitHeatRateCurves(data, thresholds) {
  const [offMaxCf, rampingMaxCf] = thresholds

  // Filter valid data points
  const valid = data.filter(d =>
    d.capacity_factor > offMaxCf &&
    d.heat_rate > 0 &&
    d.heat_rate < 30000
  )

  // Split into ramping and on states
  const rampingData = valid.filter(d => d.capacity_factor <= rampingMaxCf)
  const onData = valid.filter(d => d.capacity_factor > rampingMaxCf)

  // Fit ramping curve
  let rampingResult = null
  if (rampingData.length >= 10) {
    const xr = rampingData.map(d => d.capacity_factor)
    const yr = rampingData.map(d => d.heat_rate)
    const coeffs = polyfit(xr, yr)
    if (coeffs) {
      rampingResult = {
        coeffs,
        r2: rSquared(xr, yr, coeffs),
        n: rampingData.length,
      }
    }
  }

  // Fit on curve
  let onResult = null
  if (onData.length >= 10) {
    const xo = onData.map(d => d.capacity_factor)
    const yo = onData.map(d => d.heat_rate)
    const coeffs = polyfit(xo, yo)
    if (coeffs) {
      onResult = {
        coeffs,
        r2: rSquared(xo, yo, coeffs),
        n: onData.length,
      }
    }
  }

  // Sample scatter data for charting (~500 points max)
  const sampleSize = Math.min(500, valid.length)
  const step = Math.max(1, Math.floor(valid.length / sampleSize))
  const scatterData = []
  for (let i = 0; i < valid.length; i += step) {
    const d = valid[i]
    const state = d.capacity_factor <= rampingMaxCf ? 'ramping' : 'on'
    scatterData.push({
      cf: Math.round(d.capacity_factor * 1000) / 1000,
      hr: Math.round(d.heat_rate),
      state,
    })
  }

  return { ramping: rampingResult, on: onResult, scatterData }
}

/**
 * Evaluate heat rate at a given capacity factor using fitted curves.
 */
export function evaluateHeatRate(cf, thresholds, curves) {
  const [offMaxCf, rampingMaxCf] = thresholds

  if (cf <= offMaxCf) return 0 // Off state

  if (cf <= rampingMaxCf && curves.ramping) {
    return polyval(curves.ramping.coeffs, cf)
  }

  if (curves.on) {
    return polyval(curves.on.coeffs, cf)
  }

  return 0
}
