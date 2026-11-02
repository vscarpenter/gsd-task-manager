/**
 * Builds the `javascript:` link behind Settings → Bookmarklet. The code runs on
 * whatever page the user is reading and hands that page's details to the
 * capture fragment read by `parseShareCaptureParams`.
 *
 * Browsers percent-decode a `javascript:` URL before executing it, so the whole
 * source is encoded. Without that, a `%22` in the tags would decode to a quote
 * and close the string it sits in.
 *
 * `noreferrer` keeps the page's address out of the request that loads GSD, which
 * is the same privacy reason the details travel in a fragment.
 */
export function buildBookmarkletHref(origin: string, tags: string): string {
  const destination = JSON.stringify(`${origin}/#`);
  const source =
    `(function(){var p=new URLSearchParams({action:"capture",title:document.title,` +
    `url:location.href,tags:${JSON.stringify(tags)}});` +
    `window.open(${destination}+p.toString(),"_blank","noopener,noreferrer");})();`;
  return `javascript:${encodeURIComponent(source)}`;
}
