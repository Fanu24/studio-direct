import type { CSSProperties } from "react";

/**
 * Directory tables carry each row's primary label as a heading, so the page
 * outline lists the rows the table shows instead of stopping at the section
 * title. The reference directory pages (/web3-cities, /web3-companies,
 * /web3-salaries) do the same, which is why a 100-row company table there
 * carries 100 headings and ours carried three.
 *
 * A heading inside a table cell must not *look* like a heading, so every
 * property the global `h1..h4` rule sets - font-size, weight, family,
 * line-height, letter-spacing, colour, margin - is handed back to the cell.
 * `display: inline` also neutralises `text-wrap: balance`, which only applies
 * to block containers.
 *
 * The reset is inline rather than a class on purpose: these rows use the
 * shared `.table` primitive from `globals.css`, and adding a component-level
 * CSS import to reach it reorders the emitted CSS chunks (see the CSS
 * custom-property ordering trap in the design spec).
 */
export const TABLE_HEADING_STYLE: CSSProperties = {
  color: "inherit",
  display: "inline",
  font: "inherit",
  letterSpacing: "inherit",
  margin: 0,
};
