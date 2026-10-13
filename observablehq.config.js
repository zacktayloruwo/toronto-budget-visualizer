// See https://observablehq.com/framework/config for documentation.
export default {
  title: "Toronto Budget Visualizer",
  pages: [
    {name: "Explore the budget", path: "/explore"},
    {name: "Labour costs", path: "/labour"},
    {name: "About the data", path: "/about"}
  ],
  head: '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏙️</text></svg>">',
  root: "src",
  style: "style.css",
  theme: ["air", "near-midnight"],
  footer:
    'Data: <a href="https://open.toronto.ca/dataset/budget-operating-budget-program-summary-by-expenditure-category/">City of Toronto Open Data</a> (approved operating budgets), <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401">Statistics Canada</a> (CPI), census dwelling counts. Not an official City of Toronto product.',
  sidebar: true,
  toc: true,
  pager: false,
  search: false,
  linkify: true
};
