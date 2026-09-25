import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { searchBookmarksWithAI, isGeminiConfigured } from '@/lib/gemini';
import { Bookmark, SearchResultItem } from '@/types/bookmark';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: '検索クエリを入力してください。' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabaseが設定されていません。' },
        { status: 500 }
      );
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 }
      );
    }

    // 1. Supabaseから保存済みブックマーク全件を取得
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json(
        { error: `データ取得に失敗しました: ${dbError.message}` },
        { status: 500 }
      );
    }

    const allBookmarks = (data as Bookmark[]) || [];

    if (allBookmarks.length === 0) {
      return NextResponse.json({
        query,
        results: [],
        totalMatches: 0,
        message: '保存済みのブックマークがまだありません。まずはURLを登録してください。',
      });
    }

    // 2. Gemini 2.5 Flash にクエリとブックマークを渡し、関連度判定と推薦理由を生成
    const aiRankings = await searchBookmarksWithAI(query.trim(), allBookmarks);

    // 3. ランキング結果とブックマークのデータをマージ
    const bookmarkMap = new Map<string, Bookmark>();
    for (const b of allBookmarks) {
      bookmarkMap.set(b.id, b);
    }

    const results: SearchResultItem[] = [];
    for (const rank of aiRankings) {
      const bm = bookmarkMap.get(rank.id);
      if (bm) {
        results.push({
          ...bm,
          matchScore: rank.matchScore,
          recommendationReason: rank.recommendationReason,
        });
      }
    }

    return NextResponse.json({
      query: query.trim(),
      results,
      totalMatches: results.length,
    });
  } catch (error: unknown) {
    console.error('Unexpected error in POST /api/search:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '自然言語検索でエラーが発生しました。' },
      { status: 500 }
    );
  }
}
