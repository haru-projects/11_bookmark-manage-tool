/**
 * YouTubeやGoogleなどのリダイレクトURL（クッションページ）を検知し、本来のリンク先URLを展開して返すヘルパー
 */
export function unwrapRedirectUrl(inputUrl: string): string {
  try {
    let cleanUrl = inputUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const u = new URL(cleanUrl);

    // 1. YouTube リダイレクト (youtube.com/redirect?q=...)
    if (u.hostname.includes('youtube.com') && u.pathname.includes('/redirect')) {
      const q = u.searchParams.get('q');
      if (q) {
        return decodeURIComponent(q);
      }
    }

    // 2. Google 検索リダイレクト (google.com/url?q=... or url=...)
    if (u.hostname.includes('google.') && (u.pathname === '/url' || u.pathname === '/link')) {
      const q = u.searchParams.get('q') || u.searchParams.get('url');
      if (q) {
        return decodeURIComponent(q);
      }
    }

    return cleanUrl;
  } catch {
    return inputUrl.trim();
  }
}
