export const BASE_PATH =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost"
    ? ""
    : "/sinuca-aec";

export const GOOGLE_CLIENT_ID =
  "242727081932-ep06g0j80nti9593b2jv456b27llbgjp.apps.googleusercontent.com";

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
