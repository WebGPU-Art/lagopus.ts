import queryString from "query-string";
import isMobilejs from "ismobilejs";

export let coneBackScale = 0.5;

export let isMobile = isMobilejs(window.navigator).any; // TODO test

/** query string */
export const parsedQuery = queryString.parse(location.search);

export let threshold = parseFloat((parsedQuery["threshold"] as string) || "0.016");
