import * as d3 from "npm:d3";
import {html} from "npm:htl";

// Shared helpers: colours, formatting, units and SQL building.

// Categorical palette (fixed slot order; validated light/dark steps).
export const PALETTE = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]
};
export const OTHER = "All other";
export const OTHER_COLOR = {light: "#b5b3ad", dark: "#6b6a66"};
export const MAX_SLOTS = 7; // 7 named series + "Other"

// Fixed display orders (largest first). Colour follows the entity, so these
// orders never change with filters.
export const SERVICE_AREAS = [
  "Community & Social Services",
  "Transit",
  "Infrastructure & Development",
  "Emergency & Protective Services",
  "Corporate Accounts",
  "Corporate & Governance",
  "Agencies, Boards & Corporations"
];

export const CATEGORY_ORDER = {
  expense: [
    "Salaries & benefits",
    "Other expenditures",
    "Services & rents",
    "Contributions to capital & reserves",
    "Materials & supplies",
    "Inter-divisional charges",
    "Equipment"
  ],
  // Seven named revenue series; the rest (other revenue, inter-divisional
  // recoveries, transfers from capital) fold into "All other" in charts.
  revenue: [
    "Property tax",
    "Provincial funding",
    "User fees & licences",
    "Water & wastewater rates",
    "Federal funding",
    "Other taxes",
    "Draws from reserves",
    "Other revenue",
    "Inter-divisional recoveries",
    "Transfers from capital"
  ]
};

export const UNITS = [
  {key: "nominal", pill: "Nominal $", label: "Nominal dollars", short: "nominal $", real: false, perDwelling: false},
  {key: "real", pill: "2025 $ (inflation-adjusted)", label: "2025 dollars (inflation-adjusted)", short: "2025 $", real: true, perDwelling: false},
  {key: "nominal_dw", pill: "Nominal $ per dwelling", label: "Nominal dollars per dwelling", short: "nominal $ per dwelling", real: false, perDwelling: true},
  {key: "real_dw", pill: "2025 $ per dwelling", label: "2025 dollars per dwelling", short: "2025 $ per dwelling", real: true, perDwelling: true}
];

export const MEASURES = [
  {key: "expense", pill: "Spending", label: "Spending (expenses)"},
  {key: "revenue", pill: "Funding", label: "Funding (revenues)"},
  {key: "net", pill: "Net cost", label: "Net cost (spending minus revenue)"}
];

// Build a stable colour map: the first MAX_SLOTS keys (already ranked) get
// palette slots in order; everything else folds into "Other".
export function colorMap(rankedKeys, dark = false) {
  const pal = dark ? PALETTE.dark : PALETTE.light;
  const map = new Map();
  rankedKeys.slice(0, MAX_SLOTS).forEach((k, i) => map.set(k, pal[i]));
  return map;
}

export function foldKey(key, map) {
  return map.has(key) ? key : OTHER;
}

export function scaleFor(map, present, dark = false) {
  const domain = [...map.keys()].filter((k) => present.has(k));
  const range = domain.map((k) => map.get(k));
  if (present.has(OTHER)) {
    domain.push(OTHER);
    range.push(dark ? OTHER_COLOR.dark : OTHER_COLOR.light);
  }
  return {domain, range};
}

// ---- Formatting ------------------------------------------------------------

export function fmtMoney(v, perDwelling = false) {
  if (v == null || !isFinite(v)) return "–";
  if (Math.abs(v) < (perDwelling ? 0.5 : 5e5)) return "$0";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (perDwelling) return `${sign}$${a >= 100 ? Math.round(a).toLocaleString("en-CA") : a.toFixed(2)}`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function axisFormat(perDwelling) {
  return (v) => {
    const a = Math.abs(v), s = v < 0 ? "−" : "";
    if (perDwelling) return `${s}$${a >= 1000 ? (a / 1000).toFixed(a % 1000 ? 1 : 0) + "K" : a}`;
    if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(a % 1e9 ? 1 : 0)}B`;
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(0)}M`;
    return `${s}$${a}`;
  };
}

export const fmtPct = (v, digits = 0) => (v == null || !isFinite(v) ? "–" : `${(v * 100).toFixed(digits)}%`);

// ---- SQL helpers -----------------------------------------------------------

export const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

// Expression converting nominal `amount` (joined with years as y) to the unit.
export function unitExpr(unit, col = "amount") {
  let e = col;
  if (unit.real) e = `(${e}) * y.deflator`;
  if (unit.perDwelling) e = `(${e}) / y.dwellings`;
  return e;
}

// WHERE clause for the measure and the common filters.
export function whereClause({measure, area, program, category}) {
  const w = [];
  if (measure !== "net") w.push(`b.type = ${q(measure)}`);
  if (area && area !== "All") w.push(`b.service_area = ${q(area)}`);
  if (program && program !== "All") w.push(`b.program = ${q(program)}`);
  if (category && category !== "All" && measure !== "net") w.push(`b.category = ${q(category)}`);
  return w.length ? `WHERE ${w.join(" AND ")}` : "";
}

// Signed amount: for net, revenues count negative.
export const signedAmount = (measure) =>
  measure === "net" ? "CASE WHEN b.type = 'revenue' THEN -b.amount ELSE b.amount END" : "b.amount";

// ---- Data caveats ----------------------------------------------------------
// Each note is shown when its condition matches the current view.

export const NOTES = [
  {
    id: "derived-tax",
    when: ({measure, category}) => measure !== "expense" && (category === "All" || category === "Property tax"),
    text: "2011–2012: the published files leave out the property tax levy, so it is shown as the amount needed to balance the budget (total spending minus all other funding)."
  },
  {
    id: "tax-2013",
    when: ({measure, category}) => measure === "revenue" && ["All", "Property tax", "Other revenue"].includes(category),
    text: "2013: the file does not separate property tax from other corporate revenue, so about $0.8B of other revenue (fees, investment income, land transfer tax) is counted under Property tax that year."
  },
  {
    id: "other-taxes",
    when: ({measure, category}) => measure === "revenue" && ["All", "Other taxes", "Other revenue"].includes(category),
    text: "Other taxes (land transfer, hotel, billboard) can only be separated from 2019 on. Before 2019 they are inside Other revenue, so the jump in Other taxes in 2019 is an accounting change, not new money."
  },
  {
    id: "water-2022",
    when: ({measure, category, program}) =>
      measure !== "revenue" &&
      ["All", "Contributions to capital & reserves"].includes(category) &&
      ["All", "Toronto Water"].includes(program),
    text: "From 2022 the published files are missing roughly $1B a year of Toronto Water's transfer to its capital reserves. Spending therefore looks smaller than revenue in 2022–2026, and contributions to capital & reserves drop in 2022."
  },
  {
    id: "salaries-2021",
    when: ({measure, category}) => measure === "expense" && ["All", "Salaries & benefits"].includes(category),
    text: "Salaries & benefits combines the 'Salaries' and 'Benefits' categories that the City reports separately from 2021."
  },
  {
    id: "inflation",
    when: ({unit}) => unit?.real,
    text: "Inflation adjustment uses the Toronto all-items Consumer Price Index (annual average). 2026 uses the January–August average."
  },
  {
    id: "dwellings",
    when: ({unit}) => unit?.perDwelling,
    text: "Dwellings are total private dwellings from the 2011, 2016 and 2021 censuses, with an estimate of 1.3 million for 2026; years in between are interpolated in a straight line."
  }
];

export function notesFor(state) {
  return NOTES.filter((n) => n.when(state));
}

// ---- Plain-language descriptions -------------------------------------------

export const CATEGORY_HELP = {
  "Salaries & benefits": "Pay for City staff (permanent, part-time and casual), plus pensions, health benefits, payroll taxes and allowances.",
  "Other expenditures": "Mostly money the City passes on to others: social assistance and child-care subsidies, grants to community groups and agencies, interest and principal on debt, and property tax write-offs.",
  "Services & rents": "Work the City buys from outside companies (contracted services such as snow clearing or shelter operators), consultants, rent, insurance, telephones and postage.",
  "Contributions to capital & reserves": "Operating money set aside: transfers to the capital budget to pay for infrastructure, and deposits into reserves (savings accounts for future costs).",
  "Materials & supplies": "Things the City uses up: fuel and electricity, road salt, water-treatment chemicals, food, medical and office supplies.",
  "Inter-divisional charges": "What one City division pays another for internal services (for example, a division paying Fleet Services for vehicles). The receiving division books the same amount as an inter-divisional recovery, so citywide the two cancel out.",
  "Equipment": "Smaller equipment and furniture bought through the operating budget, such as computers and tools.",
  "Property tax": "Taxes on homes and businesses, based on assessed property value. It is the City's largest source of money and is set to balance the budget.",
  "Provincial funding": "Grants and cost-sharing from the Government of Ontario, for example for social assistance, child care, public health, transit and shelters.",
  "Federal funding": "Grants from the Government of Canada, for example for refugee shelter costs and housing.",
  "User fees & licences": "Charges paid by the people who use a service: TTC fares, recreation program fees, garbage fees, building permits and business licences. Includes donations.",
  "Water & wastewater rates": "Water bills paid by homes and businesses. They fund Toronto Water, which does not rely on property tax.",
  "Other taxes": "The municipal land transfer tax (paid when buying a home), the hotel and lodging tax, and the billboard (third-party sign) tax.",
  "Draws from reserves": "Money taken out of the City's savings accounts (reserves and reserve funds) to pay for operating costs.",
  "Other revenue": "Fines and penalties, interest and investment income, payments in lieu of taxes (before 2019), and miscellaneous revenue.",
  "Inter-divisional recoveries": "Payments one City division receives from another for internal services. They mirror inter-divisional charges.",
  "Transfers from capital": "Money moved from the capital budget to cover operating costs related to capital projects, such as staff who manage construction."
};

export const AREA_HELP = {
  "Community & Social Services": "Children's services, employment and social services, shelters and housing, long-term care, public health, parks and recreation, economic development.",
  "Transit": "The Toronto Transit Commission (subways, streetcars, buses, Wheel-Trans) and transit expansion planning.",
  "Infrastructure & Development": "Toronto Water, transportation (roads), solid waste, city planning, building permits, licensing and environment.",
  "Emergency & Protective Services": "Police, fire, paramedics and emergency management.",
  "Corporate Accounts": "Citywide accounts that do not belong to one division: debt payments, the property tax levy, non-program revenues and expenses.",
  "Corporate & Governance": "City Council, the Mayor, the City Manager, finance, legal, technology, facilities, fleet, 311 and the accountability offices.",
  "Agencies, Boards & Corporations": "Arm's-length bodies such as Toronto Public Library, the Toronto Zoo, Exhibition Place, TO Live and the Toronto Parking Authority."
};

// Year axis that labels every year; labels rotate on narrow charts.
export function yearAxis(width, first = 2011, last = 2026) {
  const ticks = d3.range(first, last + 1);
  const narrow = width < 760;
  return {
    axis: {label: null, ticks, tickFormat: (d) => String(d), tickRotate: narrow ? -90 : 0},
    marginBottom: narrow ? 44 : 30
  };
}

// ---- Controls ----------------------------------------------------------------
// Small, consistent form controls. Each returns an element with a .value and
// fires "input" events, so it works with Generators.input().

export function pills(options, {label, value, format = String, help} = {}) {
  const root = html`<div class="tb-field"><div class="tb-label">${label}</div>${help ? html`<div class="tb-help">${help}</div>` : ""}<div class="tb-pills" role="radiogroup" aria-label=${label}></div></div>`;
  const box = root.querySelector(".tb-pills");
  root.value = value ?? options[0];
  for (const o of options) {
    const b = html`<button type="button" role="radio" class="tb-pill">${format(o)}</button>`;
    const sync = () => b.setAttribute("aria-checked", String(root.value === o));
    b.addEventListener("click", () => {
      if (root.value === o) return;
      root.value = o;
      box.querySelectorAll("button").forEach((x) => x.dispatchEvent(new Event("sync")));
      root.dispatchEvent(new Event("input", {bubbles: true}));
    });
    b.addEventListener("sync", sync);
    sync();
    box.append(b);
  }
  return root;
}

export function dropdown(options, {label, value, format = String, group, disabled = false, help} = {}) {
  const select = html`<select class="tb-select" aria-label=${label}></select>`;
  const groups = group ? d3.groups(options, group) : [[null, options]];
  for (const [g, opts] of groups) {
    const parent = g == null ? select : select.appendChild(html`<optgroup label=${g}></optgroup>`);
    for (const o of opts) {
      const opt = html`<option>${format(o)}</option>`;
      opt.__value = o;
      parent.append(opt);
    }
  }
  const all = [...select.querySelectorAll("option")];
  const start = all.findIndex((o) => o.__value === value);
  select.selectedIndex = start >= 0 ? start : 0;
  select.disabled = disabled;
  const root = html`<label class="tb-field${disabled ? " tb-disabled" : ""}"><div class="tb-label">${label}</div>${help ? html`<div class="tb-help">${help}</div>` : ""}${select}</label>`;
  root.value = all[select.selectedIndex].__value;
  select.addEventListener("change", (e) => {
    e.stopPropagation();
    root.value = all[select.selectedIndex].__value;
    root.dispatchEvent(new Event("input", {bubbles: true}));
  });
  select.addEventListener("input", (e) => e.stopPropagation());
  return root;
}
