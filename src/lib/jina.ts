/**
 * Jina Reader API (https://r.jina.ai/{url}) を呼び出してWebページのMarkdownを取得する
 */
export async function fetchMarkdownWithJina(targetUrl: string): Promise<string> {
  let cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const jinaEndpoint = `https://r.jina.ai/${cleanUrl}`;

  try {
    const response = await fetch(jinaEndpoint, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(20000), // 20秒タイムアウト
    });

    if (response.ok) {
      const markdown = await response.text();
      if (markdown && markdown.trim().length > 0) {
        return markdown;
      }
    } else {
      const errText = await response.text().catch(() => '');
      console.warn(`Jina Reader returned status ${response.status}:`, errText.slice(0, 150));
    }
  } catch (jinaError: unknown) {
    console.warn(`Jina Reader fetch failed for ${cleanUrl}:`, jinaError);
  }

  // フォールバック 1: 直接HTMLを取得して簡易テキスト化
  try {
    const htmlText = await fallbackFetchHtml(cleanUrl);
    if (htmlText && htmlText.trim().length > 50) {
      return htmlText;
    }
  } catch (fallbackError: unknown) {
    console.warn(`Direct HTML fallback failed for ${cleanUrl}:`, fallbackError);
  }

  // フォールバック 2: 両方ブロックされた場合でも、Geminiが持つ知識を活用できるようURL情報をMarkdown形式で返す
  console.info(`Both Jina and Direct fetch failed for ${cleanUrl}. Falling back to URL-based AI knowledge.`);
  return `URL: ${cleanUrl}\n(Note: Webサイトの自動スクレイピングがブロックされたため、URLおよびGeminiが持つ知識に基づいてWebサイトの概要・カテゴリ・用途を推測・解析してください)`;
}

/**
 * Jina Readerが失敗した場合の直接HTMLフェッチ
 */
async function fallbackFetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Webページの直接取得に失敗しました (Status: ${response.status})`);
  }

  const html = await response.text();
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.slice(0, 10000);
}
