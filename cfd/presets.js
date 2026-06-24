// Wind tunnel presets — real-world conditions mapped to LBM parameters
// LBM Re = u0 * refLength_cells / nu,  nu = (1/omega - 0.5) / 3

export const PRESETS = {
  gt3: {
    label: 'GT3 Racing',
    icon: '🏎',
    description: 'GT3 class racing car, ~200 km/h straight-line',
    // Real world
    realSpeed_kmh: 200,
    realRe: 4_500_000,
    refLength_m: 4.5,
    // LBM parameters
    u0: 0.10,
    omega: 1.85,        // nu≈0.054, Re≈185 (scaled character)
    angle: 0,
    // Display
    color: '#f7768e',
    notes: 'Expect large wake, high drag, moderate downforce from splitter/diffuser',
    // Preset obstacle: low-slung coupe with splitter + rear wing
    shape: 'gt3',
  },

  formula1: {
    label: 'Formula 1',
    icon: '🏁',
    description: 'F1 car, ~300 km/h, extreme downforce',
    realSpeed_kmh: 300,
    realRe: 7_200_000,
    refLength_m: 5.5,
    u0: 0.13,
    omega: 1.92,        // nu≈0.027, Re≈385
    angle: 0,
    color: '#7aa2f7',
    notes: 'Negative lift (downforce). Narrow wake due to ground effect. DRS reduces drag.',
    shape: 'f1',
  },

  aviation_cruise: {
    label: 'Aviation — Cruise',
    icon: '✈',
    description: 'Commercial airliner, Mach 0.82, 35,000 ft',
    realSpeed_kmh: 900,
    realRe: 50_000_000,
    refLength_m: 6.0,   // mean chord
    u0: 0.08,
    omega: 1.97,        // nu≈0.005, Re≈960
    angle: 2,           // angle of attack at cruise
    color: '#9ece6a',
    notes: 'Attached laminar flow over wing upper surface. Shock wave near Mach 1.',
    shape: 'airfoil_naca2412',
  },

  aviation_landing: {
    label: 'Aviation — Landing',
    icon: '🛬',
    description: 'Commercial airliner, flaps extended, ~280 km/h',
    realSpeed_kmh: 280,
    realRe: 15_000_000,
    refLength_m: 6.0,
    u0: 0.07,
    omega: 1.80,
    angle: 12,          // high AoA with flaps
    color: '#e0af68',
    notes: 'High lift, risk of flow separation at leading edge. Flap wake visible.',
    shape: 'airfoil_naca2412_flap',
  },

  general_aviation: {
    label: 'General Aviation',
    icon: '🛩',
    description: 'Light aircraft (Cessna-class), ~200 km/h',
    realSpeed_kmh: 200,
    realRe: 1_500_000,
    refLength_m: 1.5,   // chord
    u0: 0.08,
    omega: 1.75,
    angle: 5,
    color: '#bb9af7',
    notes: 'Laminar-turbulent transition near mid-chord. Clean attached flow.',
    shape: 'airfoil_naca0012',
  },

  custom: {
    label: 'Custom',
    icon: '✏',
    description: 'Manual settings — draw your own shape',
    realSpeed_kmh: null,
    realRe: null,
    refLength_m: null,
    u0: 0.08,
    omega: 1.70,
    angle: 0,
    color: '#565f89',
    notes: 'Adjust all parameters manually. Draw any obstacle.',
    shape: null,
  }
};

// Compute real Reynolds number display string
export function formatRe(re) {
  if(!re) return '—';
  if(re >= 1e6) return (re/1e6).toFixed(1) + 'M';
  if(re >= 1e3) return (re/1e3).toFixed(0) + 'k';
  return re.toFixed(0);
}

// Compute LBM Re given solver params and reference length in cells
export function lbmRe(u0, omega, refCells) {
  const nu = (1/omega - 0.5) / 3;
  return Math.round(u0 * refCells / nu);
}
