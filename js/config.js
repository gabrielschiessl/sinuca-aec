export const BASE_PATH =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? ""
    : "/sinuca-aec";

export const GOOGLE_CLIENT_ID =
  "242727081932-ep06g0j80nti9593b2jv456b27llbgjp.apps.googleusercontent.com";

export const INITIAL_SEASON = 2026;
const CURRENT_SEASON_STORAGE_KEY = "aec_current_season";

export function getKnownCurrentSeason() {
  try {
    const stored = Number(localStorage.getItem(CURRENT_SEASON_STORAGE_KEY));
    return Number.isInteger(stored) && stored >= INITIAL_SEASON
      ? stored
      : INITIAL_SEASON;
  } catch (error) {
    return INITIAL_SEASON;
  }
}

export function setKnownCurrentSeason(season) {
  const normalized = Number(season);
  if (Number.isInteger(normalized) && normalized >= INITIAL_SEASON) {
    try {
      localStorage.setItem(CURRENT_SEASON_STORAGE_KEY, String(normalized));
    } catch (error) {
      return normalized;
    }
  }
  return getKnownCurrentSeason();
}

export function withBasePath(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${BASE_PATH}${normalizedPath}`;
}

export function withoutBasePath(pathname = window.location.pathname) {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }

  return pathname || "/";
}
