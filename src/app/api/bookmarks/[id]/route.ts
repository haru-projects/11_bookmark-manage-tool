import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'IDが指定されていません。' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabaseが設定されていません。' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('bookmarks').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: `削除に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: '削除しました。' });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '削除処理でエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// PATCH: ブックマークのカテゴリ等の部分更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'IDが指定されていません。' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabaseが設定されていません。' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { category } = body;

    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: '有効なカテゴリを指定してください。' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('bookmarks')
      .update({ category })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `更新に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bookmark: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新処理でエラーが発生しました。' },
      { status: 500 }
    );
  }
}
