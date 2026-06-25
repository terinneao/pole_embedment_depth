# Pole Embedment Depth Calculator — IBC 2021 (SI)

A single-page web app that computes the required embedment depth of a pole or
post subjected to a lateral load, following **IBC 2021 Section 1807.3**, with
metric (SI) inputs and outputs.

## Run it

No build step or server is required — just open `index.html` in a browser.

Optionally serve it locally:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## What it does

Given the lateral force, its height above grade, the post size and the soil's
allowable lateral bearing, it returns the required embedment depth `d`.

### Equations (IBC 2021 §1807.3.2)

**Non-constrained** (free top — Eq. 18-1 & 18-2):

```
A = 2.34 · P / (S1 · b)
d = 0.5 · A · [ 1 + sqrt( 1 + 4.36 · h / A ) ]
```

`S1` is the allowable lateral bearing at one-third the embedment depth, so the
app solves for `d` iteratively.

**Constrained** (restrained at grade — Eq. 18-3):

```
d = sqrt( 4.25 · P · h / (S3 · b) )
```

`S3` is the allowable lateral bearing at the full embedment depth.

### Units & conversions

Inputs are entered in SI and converted internally to the US-customary units the
code equations assume:

| Quantity | SI input | Internal |
|----------|----------|----------|
| Lateral force `P` | kN | lb (×224.809) |
| Height `h`, width `b` | m | ft (×3.28084) |
| Lateral bearing `S` | kPa per m of depth (= kN/m³) | psf per ft (×6.366) |
| Depth `d` | m (output) | ft (×0.3048 back) |

### Table 1806.2 lateral bearing presets

| Soil class | psf/ft | kPa/m |
|------------|-------:|------:|
| Massive crystalline bedrock | 1200 | 188.5 |
| Sedimentary & foliated rock | 400 | 62.8 |
| Sandy gravel / gravel (GW, GP) | 200 | 31.4 |
| Sand, silty/clayey sand & gravel (SW,SP,SM,SC,GM,GC) | 150 | 23.6 |
| Clay, sandy/silty clay, silt (CL,ML,MH,CH) | 100 | 15.7 |

### Options

- **Isolated pole (×2):** doubles the lateral bearing per §1806.3.4 for poles
  not adversely affected by ~12 mm movement at grade.
- **12 ft (3.66 m) cap:** freezes the lateral bearing at the code depth limit.

## Disclaimer

For preliminary design only. Always verify against the governing code edition
and project-specific geotechnical recommendations.
# pole_embedment_depth
