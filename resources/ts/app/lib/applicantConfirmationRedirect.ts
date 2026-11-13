const publicApplicantUrl = 'https://app-dev-repository.vercel.app/applicant';

export function applicantConfirmationRedirect(origin: string) {
  const url = new URL(origin);
  const { hostname } = url;
  const isLoopback = hostname === 'localhost' || hostname.endsWith('.localhost')
    || /^127(?:\.\d{1,3}){3}$/.test(hostname) || hostname === '[::1]';
  if (isLoopback) {
    return publicApplicantUrl;
  }
  return new URL('/applicant', url).href;
}
