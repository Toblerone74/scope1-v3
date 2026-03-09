import { useState, useMemo, useRef, useEffect } from 'react'

export default function FacilitySearch({ facilities, onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [fuelFilter, setFuelFilter] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Get unique states and fuel types
  const states = useMemo(() => {
    const s = [...new Set(facilities.map(f => f.state))].sort()
    return s
  }, [facilities])

  const fuelTypes = useMemo(() => {
    const f = [...new Set(facilities.map(f => f.fuel_type).filter(Boolean))].sort()
    return f
  }, [facilities])

  // Filter facilities
  const filtered = useMemo(() => {
    let result = facilities
    if (stateFilter) {
      result = result.filter(f => f.state === stateFilter)
    }
    if (fuelFilter) {
      result = result.filter(f => f.fuel_type === fuelFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        String(f.oris_id).includes(q) ||
        (f.state && f.state.toLowerCase().includes(q))
      )
    }
    return result.slice(0, 50) // Limit to 50 results for performance
  }, [facilities, query, stateFilter, fuelFilter])

  function handleSelect(fac) {
    onSelect(fac)
    setQuery(`${fac.name} (${fac.oris_id})`)
    setIsOpen(false)
  }

  return (
    <div className="facility-search" ref={wrapperRef}>
      <div className="search-filters">
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          disabled={disabled}
        >
          <option value="">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={fuelFilter}
          onChange={e => setFuelFilter(e.target.value)}
          disabled={disabled}
        >
          <option value="">All Fuel Types</option>
          {fuelTypes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search by plant name, ORIS code, or state..."
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          className="search-input"
        />
        {isOpen && filtered.length > 0 && (
          <div className="search-dropdown">
            {filtered.map(fac => (
              <div
                key={fac.oris_id}
                className="search-result"
                onClick={() => handleSelect(fac)}
              >
                <span className="result-name">{fac.name}</span>
                <span className="result-meta">
                  {fac.state} · {fac.fuel_type || 'Unknown'} · {fac.capacity_mw} MW · ORIS {fac.oris_id}
                </span>
              </div>
            ))}
            {filtered.length === 50 && (
              <div className="search-more">Showing first 50 results. Refine your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
