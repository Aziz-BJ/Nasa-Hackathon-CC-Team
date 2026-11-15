# Harmonizing MODIS and VIIRS fire hotspots: method

Space Apps 2026, "Harmonization of MODIS and VIIRS Hot Spots". Regions: mainland Italy, Sicily, Sardinia, California.
Numbers for any given run are in `RESULTS.md`, generated from the output files (`outputs_real/` = the submission run on Person A's real table; `outputs_synthetic/` = method test with known truth).
AI use: the code and this write-up were produced with AI assistance (Claude) from the team's Step 0 decisions and maths document. Declare this in the "Use of SI" field.

---

## 0. What the harmonized record estimates

$$
H_{r,t} \;=\; \text{number of 5 km fire cell-days that Aqua MODIS would have recorded in region } r \text{, month } t \text{, at its nominal 13:30 / 01:30 orbit.}
$$

Aqua is the reference because it has the longest record (from July 2002) and rarely saturates (Proof 4). "Nominal orbit" matters because Aqua drifts later from July 2021. After that date, measured Aqua is a different instrument in practice, so it is **not** used in $H$.

| Days | Source | How $H$ is obtained |
|---|---|---|
| Jul 2002 – 30 Jun 2021 | Aqua MODIS | measured |
| 1 Jul 2021 – 1 Nov 2026 (and Aqua-missing days from 20 Jan 2012) | Suomi NPP VIIRS | converted (§4) |
| from 2 Nov 2026 (and S-NPP-missing days from 1 Apr 2018) | NOAA-20 VIIRS | chained (§6) |

---

## Data and missing days

**Source table.** Person A's `cell_days.csv`: 516,854 rows, built from six FIRMS archive requests (MODIS C6.1, VIIRS S-NPP and NOAA-20 375 m; SP, plus NRT after the last SP date). Re-running Person A's code on the raw zips reproduces it byte for byte. Person A's tests pass. An independent recomputation of `cell_id` agrees on 100% of detections.

**Scan zone.** Person A's zone (fitted nadir pixel size, rmse ≤ 0.005 km) is more accurate than the inversion in `geometry.py`. The two agree on 99.99% of MODIS and 99.5% of VIIRS detections; the 0.5% that differ are two (scan, track) pairs, where Person A's assignment is the correct one.

**Missing days** (`data_real/missing_days.csv`, 128 satellite-days). Missing days are removed from the calibration pairs for both satellites, and filled from the next source in the record.
- **From FIRMS's missing-data table:** 112 days (S-NPP 80, Aqua 26, NOAA-20 6).
- **Detected in the data:** 16 days on which a satellite has **zero** points in an area and day-part while every other satellite flying then has ≥ 100. Examples: Aqua over California on 7 days of 16 Aug – 1 Sep 2020, during the August Complex; S-NPP 6 Jul 2025.
- **Check:** this rule also flags every FIRMS-listed outage it can see, which validates it.
- **Rejected rule:** a ratio-based partial-pass rule was tested and rejected. Raw point counts change with pixel size, so it flags normal edge-of-swath passes.

**Period used.** From 4 Jul 2002, the first Aqua day, to 13 Nov 2026, the last complete day.

---

## 1. Unit: the fire cell-day

A **cell** is a 5 km × 5 km square of an equal-area projection: EPSG:3035 for Italy, EPSG:3310 for California.

$$
\text{cell\_id} = \texttt{epsg}\_\lfloor x/5000\rfloor\_\lfloor y/5000\rfloor .
$$

A **cell-day** is one cell, one local solar day and one day-part (D/N) with at least one surviving detection from a given satellite.

**Why cell-days.** One MODIS pixel covers $(1/0.375)^2 = 7.1$ VIIRS pixels at nadir (Proof 2). A burning patch of side $L$ on a grid of pitch $p$ touches on average $(L/p+1)^2$ pixels, so raw row counts inflate VIIRS by a factor that grows with fire size. Each detection is placed in the cell that contains its pixel centre, so it counts once. The cell (5 km) is larger than the biggest MODIS footprint (4.83 × 2.01 km at 55°), so a fire seen by both sensors usually lands in the same one or two cells for both. Counting occupied cells instead of rows removes most of the pixel-size effect before any statistics.

**Strata.** For satellite $s$, region $r$, month $t$ and day-part $d$:

$$
N^{s}_{rtd} = \#\{\text{cell-days}\},\qquad N^{s}_{z,rtd}=\#\{\text{cell-days in scan zone } z\},\; z\in\{1,2,3\}.
$$

**Paired strata.** The reference and source counts $(M_{rtd}, V_{rtd})$ are always counted over **identical days**: the calibration window minus any day either satellite is missing (FIRMS `/api/missing_data/`). The season is $g(t)=\text{fire}$ for June–September, otherwise off. A calibration cell is $c=(r,g,d)$, giving 4 × 2 × 2 = 16 cells.

---

## 2. Scan geometry (maths document, Proofs 1–2)

Earth centre, satellite and ground pixel form a triangle with scan angle $\theta$ at the satellite and zenith angle $\psi$ at the ground. $R = 6378.137$ km; $h$ = 705 km (MODIS) or 829 km (VIIRS).

$$
\sin\psi = \frac{R+h}{R}\sin\theta,\qquad
\rho=(R+h)\cos\theta-R\cos\psi,\qquad
g_t=\frac{\rho}{h},\qquad g_s=\frac{\rho}{h\cos\psi},\qquad
D=R(\psi-\theta).
$$

Here $\rho$ is the slant range, $g_t$ and $g_s$ the along-track and along-scan growth, and $D$ the ground distance from the track. VIIRS I-band pixel: along-scan $= n(\theta)\cdot 125\,\text{m}\cdot g_s$ with $n=3,2,1$ for $\theta<31.59^\circ$, $<44.68^\circ$, $\ge 44.68^\circ$; along-track $= 375\,\text{m}\cdot g_t$.
Checks reproduced exactly:
- MODIS edge 4.83 × 2.01 km (×9.69 area); VIIRS edge 0.805 × 0.824 km (×4.72).
- Swaths 2,330 and 3,061 km.

**Scan zone from FIRMS columns.**
- MODIS: invert `scan` (monotonic in $\theta$).
- VIIRS: `scan` jumps at each aggregation boundary, and `track` (monotonic) is rounded to 0.01 km. For each candidate zone, invert `track` inside that zone's angle range, predict $(\text{scan},\text{track})$, and keep the zone with the smallest $L_1$ distance to the observed pair.
- Accuracy on simulated pixels with FIRMS rounding: VIIRS 100%; MODIS 98.2% (all errors within 0.64° of a boundary, because MODIS sizes are rounded to 0.1 km).

**Zone opportunity shares (new derivation).** Consecutive orbits in one day-part are spaced $S(\phi)=\frac{2\pi R}{1440/T_{\text{orbit}}}\cos\phi$ apart at latitude $\phi$. Under regular repeat sampling, a fixed point's offset to the *nearest* track is $\sim\mathcal U(0,S/2)$, truncated at the half-swath $W$. The probability that the nearest view falls in zone $z$ is therefore

$$
\pi_z(\phi)=\frac{\big|[D(\theta_{z-1}),D(\theta_z)]\cap[0,d_{\max}]\big|}{d_{\max}},\qquad d_{\max}=\min\!\big(S(\phi)/2,\;W\big).
$$

This matches the handover rule "zone of the detection nearest the track". $\pi_z$ is the zone mix expected from geometry alone, with no detection losses, which gives a direct physical test:

**Edge detection efficiency (physical validation of Proofs 2 and 5).** With $w_z$ the observed share of cell-days in zone $z$,

$$
e_z=\frac{w_z/\pi_z}{w_1/\pi_1}.
$$

$e_3\ll 1$ for MODIS and $e_3\approx 1$ for VIIRS is the signature of the pixel-area growth (×9.7 vs ×4.7) acting on the detection limit $\text{FRP}_{\min}\propto A_{\text{pixel}}$.

---

## 3. Conversion model (one step: source satellite → reference satellite)

$$
\mathbb E[M_{rtd}\mid V_{rtd}]=\mu_{rtd},\qquad
\log\mu_{rtd}=\underbrace{\log V_{rtd}}_{\text{offset}}+\kappa_{c(r,t,d)}+\theta_s\,x_{rtd},\qquad
x_{rtd}=\log\frac{\sum\text{FRP}^{\text{src}}_{rtd}}{V_{rtd}}-\bar s_r .
$$

$x$ is the **fire-size anomaly**: the log mean fire radiative power per source cell-day, minus the region's calibration-window value $\bar s_r=\log(\sum\text{FRP}/\sum V)$. The **conversion factor** is $k_{rtd}=\mu_{rtd}/V_{rtd}=\exp(\kappa_c+\theta_s x_{rtd})$.

**Why fire size (physics of Proof 5).** MODIS needs roughly 7× more FRP than VIIRS to trigger a detection, so it catches a larger share of big, hot fires than of small ones. A month of large fires should therefore convert at a higher rate than a month of agricultural burns. On the real data $\hat\theta_s=0.386\pm0.028$: doubling the mean FRP per VIIRS cell-day raises the factor by $2^{0.386}-1=31\%$. Adding it cut leave-one-year-out error from MALE 0.385 to 0.334 and RMSE from 58.5 to 31.5 cell-days.

**Scan-zone covariates (dropped).** Once fire size is in the model, the zone shares $w_2,w_3$ add nothing: Wald test $\theta_2=\theta_3=0$ gives $p=0.52$, and leave-one-year-out error is unchanged (0.335). Pre-registered rule: keep a term only if it improves out-of-sample error.

**Why the offset (slope fixed at 1).** A proportional factor makes predictions add up consistently ($\sum_t\mu_t=\sum_t k_tV_t$ at any time resolution). Test with the slope free: $b=1.036\pm0.021$ ($p=0.10$).

**Estimation.**
1. **Mean:** Poisson pseudo-likelihood with cell intercepts. It is consistent for the mean under any variance, and the fitted totals equal the observed totals within every cell ($\sum\hat\mu=\sum M$). Covariance by sandwich (HC0).
2. **Why not full NB2 maximum likelihood:** it down-weights large months. Leave-one-year-out it gave RMSE 45.9 and bias +3.5 cell-days per month, against 31.5 and +0.4 for the Poisson mean.
3. **Predictive variance:** NB2, $\operatorname{Var}=\mu+\alpha_r\mu^2$. $\alpha_r$ is fitted per region by profile likelihood with the mean held fixed, because count sizes and fire regimes differ a lot between regions. A single pooled $\alpha$ gave 77% coverage in mainland Italy and 98% in California; per-region $\alpha_r$ gives 86–91% everywhere.
4. **Inestimable cells:** a cell is estimable only if $\sum M>0$ and $\sum V>0$; otherwise it is filled by pooling (§5). Strata with $V=0$ are predicted as 0.
5. **Under-dispersion** ($\alpha_r=0$, Pearson $\hat\varphi<1$): predictive draws use the moment-matched binomial $\text{Bin}(\lceil\mu/(1-\hat\varphi)\rceil,\,p)$, $p=\mu/N$. This did not occur on the real data.

**Reported factor.** `factors.csv` gives the *effective* factor $\bar k_c=\sum_t\mu_t/\sum_tV_t$ over the calibration months, with 90% posterior intervals. Without pooling this equals $\sum M/\sum V$. It also gives `factor_typical_size` $=e^{\kappa_c}$, the factor in a month of typical fire size.

---

## 4. Calibration windows (chain, not one jump)

| Step | Reference ← source | Window | Why |
|---|---|---|---|
| 1 | Aqua ← S-NPP | 20 Jan 2012 – 30 Jun 2021 | Same 13:30 crossing until Aqua's drift |
| 2 | S-NPP ← NOAA-20 | 1 Apr 2018 – 1 Nov 2026 | Same instrument; NOAA-20 passes ~50 min earlier (FIRMS FAQ: ~12:40) |

---

## 5. Partial pooling: hierarchical normal model ("eight schools")

The three Italian regions share fire regimes, but Sardinia and Sicily are small. For each group $j=(g,d)$ and Italian region $i$:

$$
\hat\kappa_{ij}\mid\kappa_{ij}\sim\mathcal N(\kappa_{ij},v_{ij}),\qquad
\kappa_{ij}\mid\mu_j,\tau\sim\mathcal N(\mu_j,\tau^2),\qquad
p(\mu_j)\propto1,\quad \tau\sim\text{half-Cauchy}(0,\,0.25).
$$

$\tau$ is shared by the four groups. California is not pooled: it is one region of a different regime, and leave-one-region-out confirms Italian factors do not transfer to it.

The marginal posterior of $\tau$ is computed on a 4,001-point grid on $[0,2]$ (BDA3 eq. 5.21):

$$
\log p(\tau\mid y)=\log p(\tau)+\sum_j\Big[\tfrac12\log V_{\mu_j}-\tfrac12\sum_i\Big(\log(v_{ij}+\tau^2)+\frac{(\hat\kappa_{ij}-\hat\mu_j)^2}{v_{ij}+\tau^2}\Big)\Big],
$$

$$
\hat\mu_j=\frac{\sum_i \hat\kappa_{ij}/(v_{ij}+\tau^2)}{\sum_i 1/(v_{ij}+\tau^2)},\qquad V_{\mu_j}=\Big(\sum_i\frac{1}{v_{ij}+\tau^2}\Big)^{-1}.
$$

Draws then follow $\tau\sim p(\tau\mid y)$, $\mu_j\mid\tau\sim\mathcal N(\hat\mu_j,V_{\mu_j})$ and

$$
\kappa_{ij}\mid\mu_j,\tau\sim\mathcal N\!\Big(\frac{\hat\kappa_{ij}/v_{ij}+\mu_j/\tau^2}{1/v_{ij}+1/\tau^2},\;\frac{1}{1/v_{ij}+1/\tau^2}\Big).
$$

Integrating over $\tau$ (instead of plugging in the DerSimonian–Laird point estimate) matters with only three regions. With a plug-in $\hat\tau^2=0$, the synthetic test covered only 63% of true factors at nominal 90%; the full posterior raised this to 88%. Check: `tests/test_eight_schools.py` runs the same sampler on the eight-schools data (uniform prior on $\tau$) and reproduces the posterior medians of BDA3 Table 5.3 to within 1 point (that table is itself from 200 simulation draws).

An **unseen region** (leave-one-region-out) or an inestimable cell gets the population draw $\kappa=\mu_j+\tau\varepsilon$, from the same model fitted over all available regions.

---

## 6. NOAA-20 chain

$$
V^{S}\sim\text{Pred}\big(V^{N}e^{\kappa^{(2)}_c+\theta^{(2)}_s x^{N}},\;\text{fit 2}\big),\qquad
M^{A}\sim\text{Pred}\big(V^{S}\,e^{\kappa^{(1)}_c+\theta^{(1)}_s x'},\;\text{fit 1}\big),\qquad
x'=s^{N}+\delta_r-\bar s^{(1)}_r .
$$

- **Size on the S-NPP scale:** $\delta_r=\log\frac{\sum\text{FRP}^{S}}{\sum M}-\log\frac{\sum\text{FRP}^{N}}{\sum V}$ is the S-NPP/NOAA-20 FRP-per-cell-day offset, measured on identical days in the step-2 window. It puts NOAA-20's fire size on the S-NPP scale, and $x'$ is then centred like step 1.
- **Why the offset matters:** without it, the chain ran 4% low against the S-NPP route. With it, the ratio is 1.000.
- **Uncertainty:** drawing $V^S$ (not just its mean) carries step-2 noise into step 1.
- **Factor table:** the chained factor is $\bar k^{(1)}_c\bar k^{(2)}_c$. Its interval combines both log-scale spreads; the fits are treated as independent, which is an approximation because both see S-NPP over Apr 2018 – Jun 2021.

---

## 7. Uncertainty for any total

For each draw $b=1,\dots,B$ ($B=1000$), one parameter vector is used for **every** stratum. Predictive counts are summed within a month or year, and the 5% and 95% quantiles are reported. Sharing the draw across strata gives sums the correct parameter correlation; independent per-month draws would make annual intervals too narrow.

Two intervals are reported:
- `H_pred_lo/hi`: the predictive interval for the count. This is the one to show users.
- `H_mean_lo/hi`: the interval for the expected count (parameter uncertainty only).

Measured Aqua months have no model interval.

---

## 8. Calendar and anomalies

For region $r$, calendar month $m$ and year $y$, with baseline years $\mathcal B=\{2003,\dots,2025\}\setminus\{y\}$ (leave-target-year-out, stated on every comparison):

$$
\tilde H_m=\operatorname{median}_{y'\in\mathcal B}H_{y',m},\qquad
\Delta\%=100\,\frac{H_{y,m}-\tilde H_m}{\tilde H_m},\qquad
z=\frac{H_{y,m}-\tilde H_m}{1.4826\,\mathrm{MAD}_m},\qquad
P=100\cdot\frac{\#\{y'\in\mathcal B: H_{y',m}\le H_{y,m}\}}{|\mathcal B|}.
$$

The current, partial month is compared **month-to-date** (days 1..N in every year) by `current_month_to_date.csv`, never against whole past months.

---

## 9. Validation protocol

| Test | What it shows |
|---|---|
| **Leave-one-year-out** over the step-1 window, vs naive splice, one global ratio, per-region ratio, per-cell ratio, and model ablations (no zone, no pooling) | Out-of-sample accuracy on monthly regional totals: MAE, RMSE, bias, $R^2$, MALE $=\overline{|\log\frac{\hat M+1}{M+1}|}$, and 90% predictive coverage |
| **Leave-one-region-out** | Whether a factor learnt elsewhere transfers (it does not, from Italy to California: region-specific calibration is necessary) |
| **Seam tests:** fit before a split, predict the 24 months after, $\log(\sum M/\sum\hat\mu)$ with month-bootstrap × parameter-draw interval | No step where the source switches (Jul 2021, Nov 2026) |
| **Chain stress test:** NOAA-20 alone through the chain over Jul 2021 – Oct 2026 vs the S-NPP route | The chain is safe to rely on after S-NPP ends |
| **Known extreme years** (Sardinia 2021, Sicily 2023) | Annual rank and July percentile / robust z in the harmonized calendar |
| **Diagnostics** | Elasticity $b=1$; zone Wald test $\theta_2=\theta_3=0$; trend in the factor; $\alpha$, $\hat\varphi$; DerSimonian–Laird $Q$ |
| **Edge efficiency** $e_z$ | Physical consistency with Proofs 2 and 5 |
| **Aqua drift diagnostic** | Drifted Aqua / harmonized after Jul 2021: the size of the drift effect the record avoids |
| **Synthetic recovery** (generator `synth.py`) | Recovers known factors; end-to-end the harmonized series vs $\mathbb E[\text{Aqua at nominal orbit}]$ |

**Model choice on the real data (leave-one-year-out, monthly regional totals).**

| Variant | MALE | RMSE | Bias | Decision |
|---|---|---|---|---|
| per-cell ratio | 0.385 | 58.5 | −0.8 | baseline |
| + fire size | 0.334 | 31.5 | +0.4 | **kept** |
| + scan zone | 0.335 | 32.0 | +0.5 | dropped (no gain, $p=0.52$) |
| no pooling | 0.334 | 31.6 | +0.4 | pooling kept: no cost, stabilises Sardinia |
| NB2 maximum likelihood | 0.334 | 45.9 | +3.5 | Poisson mean kept |

**Seam tests with placebos.** A month-bootstrap interval ignores year-to-year changes in the factor. So the real switch points are compared with the same test run at earlier, placebo dates. A real seam would show as a step outside the placebo spread.

**Edge efficiency on real data.** VIIRS values above 1 come from second, off-nadir passes. At these latitudes VIIRS swaths overlap, and Person A keeps the nearest *detecting* pass, which the one-view opportunity model $\pi_z$ ignores. The MODIS values (0.19–0.36) are the physical signal.

---

## 10. Limits (state these in the submission)

1. **What a count means:** hotspot cell-days measure observed burning activity, not burned area or number of fires. Zero detections is not "no fire": cloud, smoke and overpass gaps hide fires.
2. **No Terra:** the record starts in July 2002 and has no morning overpass.
3. **Factor structure:** the factor varies by region, season, day/night and fire size. What is left over is in the predictive intervals: about ±40% for a single month in the Italian regions and ±15% in California.
8. **Cell-days measure spread, not intensity.** One catastrophic fire fills few 5 km cells. Sardinia July 2021 (Montiferru) was the top July of the VIIRS era in raw S-NPP cell-days, but ranks 8th of 25 Julys in the harmonized record. The widespread fire seasons of 2003, 2005, 2007 and 2009 (measured Aqua) had more fire cell-days. A harmonized FRP layer would show intensity; it is not built yet.
9. **No region transfer:** factors learnt on three regions do not carry over to the fourth (leave-one-region-out). Each new region needs its own overlap-years calibration.
4. **Recent months:** these are near-real-time data (NRT, flagged) and may change when standard-quality data replace them.
5. **Geometric shares** assume regular repeat-orbit sampling and use one latitude per region.
6. **Clouds** are assumed to affect sensors that pass at the same time equally. The ~50 min NOAA-20 / S-NPP difference is absorbed by the step-2 factor.
7. **Cell-day collapse** keeps one zone per cell-day (nearest track). Two passes in one day-part count once.
