// Shared by oauth_web_redirect.pb.js. Builds the redirect from a provider's
// return (a GET query string, or Apple's form_post body) to the web app's
// callback page. code, state, and error travel in the URL fragment so they
// stay out of CDN access logs and Referer headers.

const MAX_PARAM_LENGTH = 2048;
const CALLBACK_PARAMS = ["code", "state", "error"];

// readParam returns the raw string for a name, from the form body or the
// query string (the hook passes http.Request.FormValue).
function callbackLocation(readParam, target) {
  const parts = [];
  for (const name of CALLBACK_PARAMS) {
    const value = String(readParam(name) || "");
    if (value && value.length <= MAX_PARAM_LENGTH) {
      parts.push(name + "=" + encodeURIComponent(value));
    }
  }
  return target + "#" + parts.join("&");
}

module.exports = { callbackLocation };
