/**
 * Static emission factors by fuel type.
 * All values in lbs/MMBtu.
 * Source: EPA, IPCC, CEMS facility data
 */

const EMISSION_FACTORS = {
  'Coal ST':        { co2: 214.2, so2: 0.39,   nox: 0.16  },
  'Coal':           { co2: 214.2, so2: 0.39,   nox: 0.16  },
  'Coal Steam':     { co2: 214.2, so2: 0.39,   nox: 0.16  },
  'Natural Gas CC': { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Gas CC':         { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Combined Cycle': { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Natural Gas GT': { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Gas GT':         { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Gas Turbine':    { co2: 117.0, so2: 0.0006, nox: 0.139 },
  'Oil ST':         { co2: 161.4, so2: 1.7,    nox: 0.28  },
  'Oil':            { co2: 161.4, so2: 1.7,    nox: 0.28  },
  'Oil Steam':      { co2: 161.4, so2: 1.7,    nox: 0.28  },
}

const DEFAULT_FACTORS = { co2: 140.0, so2: 0.5, nox: 0.2 }

export function getFactors(fuelType) {
  if (!fuelType) return { ...DEFAULT_FACTORS }

  // Exact match (case-insensitive)
  for (const [key, factors] of Object.entries(EMISSION_FACTORS)) {
    if (key.toLowerCase() === fuelType.toLowerCase()) {
      return { ...factors }
    }
  }

  // Partial match
  const lower = fuelType.toLowerCase()
  for (const [key, factors] of Object.entries(EMISSION_FACTORS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return { ...factors }
    }
  }

  return { ...DEFAULT_FACTORS }
}
