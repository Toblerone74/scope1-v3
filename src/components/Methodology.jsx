export default function Methodology() {
  return (
    <div className="methodology">
      <h3>Methodology</h3>

      <section>
        <h4>Data Source</h4>
        <p>
          Hourly Continuous Emissions Monitoring System (CEMS) data from the EPA's
          Clean Air Markets Program Data (CAMPD) API. This includes gross load (MW),
          heat input (MMBtu), and measured emissions for all EPA-regulated thermal
          generating units.
        </p>
      </section>

      <section>
        <h4>3-State Operating Model</h4>
        <p>
          Power plants operate in three distinct thermodynamic regimes with different
          heat-rate characteristics:
        </p>
        <div className="state-descriptions">
          <div className="state-desc off">
            <strong>Off State</strong> (CF ≤ threshold)
            <p>Unit is not generating. No fuel consumption or emissions.</p>
          </div>
          <div className="state-desc ramping">
            <strong>Ramping State</strong> (low CF)
            <p>
              Unit is starting up or ramping. Heat rates are 20–40% higher than steady-state
              due to thermal cycling inefficiencies. A separate polynomial captures this regime.
            </p>
          </div>
          <div className="state-desc on">
            <strong>On State</strong> (high CF)
            <p>
              Unit is in steady-state operation. Heat rate follows a relatively stable
              quadratic relationship with capacity factor.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h4>Polynomial Regression</h4>
        <p>
          For each operating state, a 2nd-order polynomial is fitted to the
          heat rate (Btu/kWh) vs. capacity factor relationship:
        </p>
        <div className="formula">
          HR = c₂·CF² + c₁·CF + c₀
        </div>
        <p>
          Coefficients are computed using the normal equations (Cramer's rule for 3×3
          systems), equivalent to numpy.polyfit(cf, hr, 2). R² values indicate
          goodness of fit.
        </p>
      </section>

      <section>
        <h4>Threshold Detection</h4>
        <p>
          Operating state thresholds are auto-detected from the data:
        </p>
        <ul>
          <li><strong>Off threshold:</strong> 2nd percentile of the capacity factor distribution</li>
          <li><strong>Ramping threshold:</strong> Detected via coefficient-of-variation elbow in binned heat-rate data, with fuel-type-specific fallbacks (Coal ~40%, Gas CC ~30%, Gas GT ~25%)</li>
        </ul>
      </section>

      <section>
        <h4>Emission Factors</h4>
        <p>
          CO₂, SO₂, and NOₓ emission factors (lbs/MMBtu) are sourced from EPA AP-42
          and IPCC guidelines, indexed by fuel type:
        </p>
        <table className="factors-table">
          <thead>
            <tr><th>Fuel Type</th><th>CO₂</th><th>SO₂</th><th>NOₓ</th></tr>
          </thead>
          <tbody>
            <tr><td>Coal</td><td>214.2</td><td>0.39</td><td>0.16</td></tr>
            <tr><td>Natural Gas</td><td>117.0</td><td>0.0006</td><td>0.139</td></tr>
            <tr><td>Oil</td><td>161.4</td><td>1.7</td><td>0.28</td></tr>
          </tbody>
        </table>
        <p className="table-note">Values in lbs/MMBtu</p>
      </section>

      <section>
        <h4>Emissions Calculation</h4>
        <p>For each hour with generation MW:</p>
        <ol>
          <li>Compute capacity factor: CF = MW / Capacity_MW</li>
          <li>Classify operating state (off / ramping / on)</li>
          <li>Look up heat rate from fitted polynomial: HR(CF)</li>
          <li>Calculate heat input: HI = HR × MW × 1000 / 10⁶ (MMBtu)</li>
          <li>Calculate emissions: Pollutant = HI × Factor (lbs)</li>
        </ol>
      </section>
    </div>
  )
}
