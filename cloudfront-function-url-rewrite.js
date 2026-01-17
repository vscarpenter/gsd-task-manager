/**
 * CloudFront Function: URL Rewrite for Static Export with Trailing Slashes
 *
 * This function rewrites directory paths to include index.html for Next.js static exports.
 * It handles paths like /dashboard/ → /dashboard/index.html before the request reaches S3.
 *
 * CloudFront Functions run at CloudFront edge locations with sub-millisecond latency.
 *
 * Note: Security headers are handled by a CloudFront Response Headers Policy
 * (gsd-security-headers) which is the AWS-recommended approach.
 *
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If URI ends with /, append index.html
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  }
  // If URI has no file extension and doesn't end with /, append /index.html
  else if (!uri.includes('.') && uri !== '/') {
    request.uri = uri + '/index.html';
  }

  return request;
}
