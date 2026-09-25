import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { fetchMarkdownWithJina } from '@/lib/jina';
import { analyzeWebContent, isGeminiConfigured } from '@/lib/gemini';
import { Bookmark } from '@/types/bookmark';
import { unwrapRedirectUrl } from '@/lib/urlHelper';
import { INITIAL_BOOKMARKS } from '@/lib/initialBookmarks';

// GET: 保存済みブックマーク一覧取得
export async function GET() {
  try {
    // Supabaseが未設定の場合は、高品質な初期サンプルブックマーク（15件）を返却
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        bookmarks: INITIAL_BOOKMARKS,
        configured: false,
        demoMode: true,
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error, fallback to initial bookmarks:', error);
      return NextResponse.json({
        bookmarks: INITIAL_BOOKMARKS,
        configured: false,
        demoMode: true,
      });
    }

    return NextResponse.json({
      bookmarks: (data as Bookmark[]) || INITIAL_BOOKMARKS,
      configured: true,
      demoMode: false,
    });
  } catch (error: unknown) {
    console.error('Unexpected error in GET /api/bookmarks:', error);
    return NextResponse.json({
      bookmarks: INITIAL_BOOKMARKS,
      configured: false,
      demoMode: true,
    });
  }
}

// POST: URL登録 & 自動解析
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: '有効なURLを入力してください。' },
        { status: 400 }
      );
    }

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // YouTubeやGoogleなどのリダイレクトURLを本来の飛び先URLに自動展開
    cleanUrl = unwrapRedirectUrl(cleanUrl);

    // URL形式の検証
    try {
      new URL(cleanUrl);
    } catch {
      return NextResponse.json(
        { error: 'URLの形式が正しくありません。' },
        { status: 400 }
      );
    }

    // 環境変数チェック (Geminiは必須)
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    // 1. Jina Reader APIでWebページのMarkdown取得
    let markdownContent = '';
    try {
      markdownContent = await fetchMarkdownWithJina(cleanUrl);
    } catch (jinaError: unknown) {
      console.error('Failed to fetch markdown with Jina:', jinaError);
      return NextResponse.json(
        { error: `ページの取得に失敗しました: ${jinaError instanceof Error ? jinaError.message : '取得エラー'}` },
        { status: 502 }
      );
    }

    // 2. Gemini 2.5 Flash Structured Outputsでメタデータ抽出（本物のAI解析）
    let analysis;
    try {
      analysis = await analyzeWebContent(markdownContent, cleanUrl);
    } catch (geminiError: unknown) {
      console.error('Failed to analyze with Gemini:', geminiError);
      return NextResponse.json(
        { error: `AIによるコンテンツ解析に失敗しました: ${geminiError instanceof Error ? geminiError.message : '解析エラー'}` },
        { status: 500 }
      );
    }

    // 3. Supabaseが設定されていればDB保存、未設定ならメモリ用オブジェクトを返却（サンドボックスモード）
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error: dbError } = await supabase
          .from('bookmarks')
          .upsert(
            {
              url: cleanUrl,
              title: analysis.title,
              summary: analysis.summary,
              category: analysis.category,
              tags: analysis.tags || [],
              use_cases: analysis.useCases || [],
              commercial_use: analysis.commercialUse,
              raw_content: markdownContent.slice(0, 10000),
            },
            { onConflict: 'url' }
          )
          .select()
          .single();

        if (!dbError && data) {
          return NextResponse.json({
            message: 'ブックマークが正常に解析・保存されました。',
            bookmark: data as Bookmark,
          });
        }
      } catch (dbErr) {
        console.warn('Supabase upsert failed, continuing in demo mode:', dbErr);
      }
    }

    // 公開デモ用：DB書き込みを行わず、解析されたブックマークオブジェクトを直接返却
    const demoBookmark: Bookmark = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      url: cleanUrl,
      title: analysis.title,
      summary: analysis.summary,
      category: analysis.category,
      tags: analysis.tags || [],
      use_cases: analysis.useCases || [],
      commercial_use: analysis.commercialUse,
      raw_content: markdownContent.slice(0, 10000),
    };

    return NextResponse.json({
      message: 'ブックマークが正常に解析されました（デモモード）。',
      bookmark: demoBookmark,
    });
  } catch (error: unknown) {
    console.error('Unexpected error in POST /api/bookmarks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
