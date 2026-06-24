"use strict";

/* =====================================================================
   Pole / Post embedment depth — IBC 2021 §1807.3 (SI front-end)

   The IBC equations are dimensional (US-customary). We convert SI inputs
   to ft / lb / (psf per ft of depth), solve, then convert d back to m.

   Non-constrained  (Eq. 18-1, 18-2):
       A = 2.34 * P / (S1 * b)
       d = 0.5 * A * (1 + sqrt(1 + 4.36 * h / A))
       S1 = (lateral bearing per ft) * (d/3)        -> iterate

   Constrained      (Eq. 18-3):
       d = sqrt(4.25 * P * h / (S3 * b))
       S3 = (lateral bearing per ft) * d            -> closed form in d:
       d = ( 4.25 * P * h / (s * b) ) ^ (1/3)
   ===================================================================== */

// ---- Unit conversions ----
const M_TO_FT = 3.280839895;          // 1 m  -> ft
const KN_TO_LB = 224.808943;          // 1 kN -> lb
const KNM3_TO_PSFFT = 6.365880;       // 1 kN/m^3 (= kPa/m) -> psf per ft of depth
const FT_TO_M = 0.3048;
const DEPTH_CAP_FT = 12;              // §1807.3.2.1 — depth limit for lateral pressure

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const soilSel = $("soil");
const Sinput = $("S");

// Keep S field in sync with the soil-class dropdown
soilSel.addEventListener("change", () => {
  if (soilSel.value === "custom") {
    Sinput.removeAttribute("readonly");
    Sinput.focus();
  } else {
    Sinput.value = soilSel.value;
    Sinput.setAttribute("readonly", "readonly");
  }
});
Sinput.addEventListener("input", () => { soilSel.value = "custom"; });

document.querySelectorAll('input[name="condition"]').forEach((r) =>
  r.addEventListener("change", updateCondHint)
);
function updateCondHint() {
  const c = document.querySelector('input[name="condition"]:checked').value;
  $("condHint").innerHTML =
    c === "constrained"
      ? "Lateral restraint provided at grade (e.g. slab/pavement). Eq. 18&#8209;3."
      : "No lateral restraint at the ground surface (free top). Eq. 18&#8209;1 / 18&#8209;2.";
}

$("calcBtn").addEventListener("click", calculate);
// initial readonly state for preset soil
if (soilSel.value !== "custom") Sinput.setAttribute("readonly", "readonly");

function num(id) {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) ? v : NaN;
}

function calculate() {
  const P_kN = num("P");
  const h_m = num("h");
  const b_m = num("b");
  const S_si = num("S"); // kPa/m = kN/m^3
  const isolated = $("isolated").checked;
  const cap12 = $("cap12").checked;
  const condition = document.querySelector('input[name="condition"]:checked').value;

  const warnings = [];
  if (![P_kN, h_m, b_m, S_si].every((x) => Number.isFinite(x) && x > 0)) {
    showError("Please enter positive numeric values for P, h, b and S.");
    return;
  }

  // Convert to US-customary
  const P = P_kN * KN_TO_LB;            // lb
  const h = h_m * M_TO_FT;              // ft
  const b = b_m * M_TO_FT;             // ft
  let s = S_si * KNM3_TO_PSFFT;        // psf per ft of depth (lateral bearing gradient)
  if (isolated) s *= 2;               // §1806.3.4 isolated pole

  const depthForS = (d) => (cap12 ? Math.min(d, DEPTH_CAP_FT) : d); // ft

  let d_ft, A_final = null, Sused, iterations = 0, converged = true;

  if (condition === "constrained") {
    // d = ( 4.25 P h / (s b) ) ^ (1/3)  with S3 = s*d  (depth cap handled below)
    d_ft = Math.cbrt((4.25 * P * h) / (s * b));
    if (cap12 && d_ft > DEPTH_CAP_FT) {
      // S3 frozen at cap depth -> linear solve: d = 4.25 P h / (s * dcap * b)
      const S3cap = s * DEPTH_CAP_FT;
      d_ft = Math.sqrt((4.25 * P * h) / (S3cap * b));
    }
    Sused = s * depthForS(d_ft); // S3 (psf)
  } else {
    // Non-constrained: iterate on d
    let d = h > 0 ? h : 1; // initial guess (ft)
    for (iterations = 1; iterations <= 200; iterations++) {
      const S1 = s * (depthForS(d) / 3);          // psf
      const A = (2.34 * P) / (S1 * b);            // ft
      const dNew = 0.5 * A * (1 + Math.sqrt(1 + (4.36 * h) / A));
      if (Math.abs(dNew - d) < 1e-7) { d = dNew; A_final = A; break; }
      d = 0.5 * (d + dNew); // under-relax for stability
      A_final = A;
    }
    if (iterations > 200) converged = false;
    d_ft = d;
    Sused = s * (depthForS(d_ft) / 3); // S1 (psf)
  }

  const d_m = d_ft * FT_TO_M;

  // ---- Warnings ----
  if (!converged) warnings.push("Iteration did not fully converge — result is approximate.");
  if (cap12 && d_ft > DEPTH_CAP_FT)
    warnings.push("Embedment exceeds the 3.66 m (12 ft) limit; lateral bearing was frozen at that depth per §1807.3.");
  if (d_m / b_m < 0.5)
    warnings.push("Very shallow embedment relative to post width — verify applicability of the method.");

  render({
    d_m, d_ft, condition, A_final,
    Sused_psf: Sused, Sused_kPa: Sused / 20.8854,
    P, h, b, s, iterations, isolated, cap12, warnings,
    P_kN, h_m, b_m, S_eff_si: s / KNM3_TO_PSFFT
  });
}

function render(r) {
  $("depthOut").textContent = r.d_m.toFixed(3);

  const rows = [];
  rows.push(["Embedment depth, d", `${r.d_m.toFixed(3)} m  (${r.d_ft.toFixed(3)} ft)`]);
  rows.push(["Condition", r.condition === "constrained" ? "Constrained (Eq. 18-3)" : "Non-constrained (Eq. 18-1/2)"]);
  if (r.condition !== "constrained")
    rows.push(["Coefficient A", `${(r.A_final * FT_TO_M).toFixed(3)} m  (${r.A_final.toFixed(3)} ft)`]);
  const Slabel = r.condition === "constrained" ? "S₃ (at full depth)" : "S₁ (at d/3)";
  rows.push([Slabel, `${r.Sused_kPa.toFixed(2)} kPa  (${r.Sused_psf.toFixed(0)} psf)`]);
  rows.push(["Effective lateral bearing", `${r.S_eff_si.toFixed(2)} kPa/m${r.isolated ? "  (×2 isolated)" : ""}`]);
  if (r.condition !== "constrained") rows.push(["Iterations", String(r.iterations)]);
  rows.push(["Slenderness d / b", (r.d_m / r.b_m).toFixed(2)]);

  $("detailBody").innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");

  const warnBox = $("warnBox");
  if (r.warnings.length) {
    warnBox.classList.remove("hidden");
    warnBox.innerHTML =
      "<strong>Notes</strong><ul>" + r.warnings.map((w) => `<li>${w}</li>`).join("") + "</ul>";
  } else {
    warnBox.classList.add("hidden");
  }
}

function showError(msg) {
  $("depthOut").textContent = "—";
  $("detailBody").innerHTML = `<tr><td>${msg}</td><td></td></tr>`;
  const warnBox = $("warnBox");
  warnBox.classList.remove("hidden");
  warnBox.innerHTML = `<strong>Input error</strong><br>${msg}`;
}

updateCondHint();
calculate();
