// See https://observablehq.com/framework/config for documentation.

// Runs in <head> before the page paints: applies the saved (or system) theme,
// adds the light/dark toggle to the bottom of the sidebar, and nests each page's section headings under
// its link in the left sidebar.
const headScript = `<script>
(function () {
  var KEY = "tb-theme", root = document.documentElement, saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var theme = saved === "light" || saved === "dark" ? saved
    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.setAttribute("data-theme", theme);

  function label() {
    var b = document.getElementById("tb-theme-toggle");
    if (!b) return;
    var dark = root.getAttribute("data-theme") === "dark";
    b.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("#tb-theme-toggle")) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (err) {}
    label();
  });

  document.addEventListener("DOMContentLoaded", function () {
    var sidebar = document.getElementById("observablehq-sidebar");
    if (sidebar) {
      var foot = document.createElement("div");
      foot.className = "tb-sidebar-footer";
      foot.innerHTML = '<button id="tb-theme-toggle" type="button">Theme</button>';
      sidebar.appendChild(foot);
    }
    label();
    // The site title also links to the home page; use the page entry (the last match).
    var actives = document.querySelectorAll("#observablehq-sidebar li.observablehq-link-active");
    var active = actives[actives.length - 1];
    if (!active) return;
    var heads = Array.prototype.filter.call(
      document.querySelectorAll("#observablehq-main h2[id]"),
      function (h) { return !h.closest(".card"); }
    );
    if (!heads.length) return;
    var ol = document.createElement("ol");
    ol.className = "tb-subtoc";
    var items = heads.map(function (h) {
      var li = document.createElement("li"), a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      ol.appendChild(li);
      return li;
    });
    active.appendChild(ol);
    function spy() {
      var current = 0;
      heads.forEach(function (h, i) { if (h.getBoundingClientRect().top < 140) current = i; });
      items.forEach(function (li, i) { li.classList.toggle("tb-current", i === current); });
    }
    addEventListener("scroll", spy, {passive: true});
    spy();
  });
})();
</script>`;

export default {
  title: "Toronto Budget Visualizer",
  pages: [
    {name: "Overview", path: "/"},
    {name: "Explore the budget", path: "/explore"},
    {name: "Labour costs", path: "/labour"},
    {name: "About the data", path: "/about"}
  ],
  head:
    '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏙️</text></svg>">' +
    headScript,
  root: "src",
  style: "style.css",
  footer:
    'Data: <a href="https://open.toronto.ca/dataset/budget-operating-budget-program-summary-by-expenditure-category/">City of Toronto Open Data</a> (approved operating budgets), <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810000401">Statistics Canada</a> (CPI), census dwelling counts. Not an official City of Toronto product.',
  sidebar: true,
  toc: false,
  pager: false,
  search: false,
  linkify: true
};
