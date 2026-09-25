'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Bookmark,
  SearchResultItem,
} from '@/types/bookmark';
import {
  CATEGORY_DEFINITIONS,
  getCategoryIcon,
  normalizeCategory,
} from '@/lib/categories';
import {
  Search,
  PlusCircle,
  ExternalLink,
  Sparkles,
  Tag,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  KeyRound,
  FileCode2,
  ChevronDown,
  ChevronUp,
  Layers,
  Filter,
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  '商用利用できる効果音・BGM',
  'Unityで使える3Dモデル素材',
  '商用フリーのUIアイコン素材',
  '商用利用OKの日本語フォント',
  '商用利用可能な無料写真・イラスト',
];

export default function Home() {
  // 状態管理
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  // フィルター状態
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 用途アコーディオン展開状態 (カードIDのSet)
  const [expandedUseCases, setExpandedUseCases] = useState<Record<string, boolean>>({});

  // 登録フォームの開閉 (省スペース化)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<string>('');
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 削除管理
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // システム設定・警告
  const [serverError, setServerError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // 一覧取得
  const fetchBookmarks = useCallback(async () => {
    setIsLoadingList(true);
    setServerError(null);
    try {
      const res = await fetch('/api/bookmarks');
      const data = await res.json();
      if (!res.ok || data.error) {
        setServerError(data.error || 'ブックマークの取得に失敗しました');
        if (data.configured === false) {
          setIsConfigured(false);
        }
      } else {
        setBookmarks(data.bookmarks || []);
        setIsConfigured(true);
      }
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'ネットワークエラーが発生しました');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // URL登録
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setIsRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegistrationStep('Webページを取得中 (Jina Reader)...');

    try {
      const timer = setTimeout(() => {
        setRegistrationStep('Gemini がコンテンツを解析・要約中...');
      }, 2000);

      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      });

      clearTimeout(timer);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '登録処理に失敗しました。');
      }

      if (data.bookmark) {
        setBookmarks((prev) => [
          data.bookmark,
          ...prev.filter((b) => b.id !== data.bookmark.id && b.url !== data.bookmark.url),
        ]);
      }
      setRegisterSuccess(`「${data.bookmark.title}」を登録しました！`);
      setNewUrl('');

      // 検索中の場合はクリアして最新リストを表示
      setSearchResults(null);
      setActiveQuery('');
      await fetchBookmarks();
    } catch (err: unknown) {
      setRegisterError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setIsRegistering(false);
      setRegistrationStep('');
    }
  };

  // 自然言語検索
  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery ?? searchQuery;
    if (!query.trim()) return;

    setIsSearching(true);
    setActiveQuery(query.trim());
    setSearchQuery(query.trim());

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '検索に失敗しました。');
      }

      setSearchResults(data.results || []);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '検索エラーが発生しました。');
    } finally {
      setIsSearching(false);
    }
  };

  // 検索クリア
  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchQuery('');
    setActiveQuery('');
  };

  // すべてのフィルター解除
  const handleResetAllFilters = () => {
    handleClearSearch();
    setSelectedCategory(null);
    setSelectedTag(null);
  };

  // 用途アコーディオンのトグル
  const toggleUseCase = (id: string) => {
    setExpandedUseCases((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 削除処理
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除してもよろしいですか？`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '削除に失敗しました');
      }

      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      if (searchResults) {
        setSearchResults((prev) => (prev ? prev.filter((b) => b.id !== id) : null));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  // カテゴリ手動変更
  const handleCategoryChange = async (id: string, newCategory: string) => {
    // 楽観的UI更新
    setBookmarks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, category: newCategory } : b))
    );
    if (searchResults) {
      setSearchResults((prev) =>
        prev ? prev.map((b) => (b.id === id ? { ...b, category: newCategory } : b)) : null
      );
    }

    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'カテゴリ更新に失敗しました');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'カテゴリの更新に失敗しました');
      fetchBookmarks();
    }
  };

  // カテゴリ集計（8つの規定カテゴリごとに件数を算出）
  const categorizedList = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const b of bookmarks) {
      const normCat = normalizeCategory(b.category);
      countMap.set(normCat, (countMap.get(normCat) || 0) + 1);
    }

    return CATEGORY_DEFINITIONS.map((def) => ({
      ...def,
      count: countMap.get(def.name) || 0,
    }));
  }, [bookmarks]);

  // 上位タグ集計（全件から頻度順）
  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      if (b.tags && Array.isArray(b.tags)) {
        for (const t of b.tags) {
          const cleanTag = t.trim();
          if (cleanTag) {
            map.set(cleanTag, (map.get(cleanTag) || 0) + 1);
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [bookmarks]);

  // 商用利用の判定スタイル
  const getCommercialBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('不可') || s.includes('非商用') || s.includes('禁止') || s.includes('個人利用のみ')) {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        icon: ShieldAlert,
      };
    }
    if (s.includes('商用利用可') || s.includes('商用可') || s.includes('cc0') || s.includes('フリー') || s.includes('無料')) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        icon: ShieldCheck,
      };
    }
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      icon: ShieldAlert,
    };
  };

  // 表示するベースアイテム（検索結果優先、それ以外は全件）
  const baseItems = searchResults !== null ? searchResults : bookmarks;

  // カテゴリ & タグフィルター適用後の最終表示アイテム
  const displayedItems = useMemo(() => {
    return baseItems.filter((item) => {
      if (selectedCategory && normalizeCategory(item.category) !== selectedCategory) {
        return false;
      }
      if (selectedTag && (!item.tags || !item.tags.includes(selectedTag))) {
        return false;
      }
      return true;
    });
  }, [baseItems, selectedCategory, selectedTag]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* 背景の装飾グラデーション */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-25 dark:opacity-15 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-400 rounded-full blur-3xl"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-blue-400 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ヘッダー: コンパクト化 ＆ 新規登録トグルボタン */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold tracking-wide uppercase">
                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                Gemini 2.5 Flash & Jina Reader
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-700 dark:from-white dark:via-indigo-200 dark:to-indigo-400 bg-clip-text text-transparent">
              AI Webリソース & 素材ブックマーク
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* 新規登録トグルボタン (省スペース化) */}
            <button
              onClick={() => setIsRegisterOpen(!isRegisterOpen)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                isRegisterOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
              }`}
            >
              <PlusCircle className={`w-4 h-4 transition-transform ${isRegisterOpen ? 'rotate-45' : ''}`} />
              <span>{isRegisterOpen ? '閉じる' : '新規リソース登録'}</span>
            </button>

            {/* 一覧更新ボタン */}
            <button
              onClick={() => fetchBookmarks()}
              disabled={isLoadingList}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
              title="一覧を再読み込み"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">更新</span>
            </button>
          </div>
        </header>

        {/* 展開式・省スペース登録フォーム (アコーディオン) */}
        {isRegisterOpen && (
          <div className="mb-6 p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-indigo-200 dark:border-indigo-900/80 transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                URLを入力してAI自動解析
              </h2>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              WebページのコンテンツをJina Readerで取得し、Gemini 2.5 Flashがタイトル・概要・商用利用規約・タグ・用途を自動抽出して保存します。
            </p>

            <form onSubmit={handleRegister} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="url"
                  required
                  disabled={isRegistering}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/ などの素材・ツールサイトURL"
                  className="w-full pl-3.5 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isRegistering || !newUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition shadow-sm disabled:opacity-50 shrink-0"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI解析して保存</span>
                  </>
                )}
              </button>
            </form>

            {/* 登録進行ステップ */}
            {isRegistering && (
              <div className="mt-3 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-600" />
                <span className="font-medium animate-pulse">{registrationStep}</span>
              </div>
            )}

            {/* 成功メッセージ */}
            {registerSuccess && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{registerSuccess}</span>
                </div>
                <button onClick={() => setRegisterSuccess(null)} className="text-emerald-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* エラーメッセージ */}
            {registerError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{registerError}</span>
                </div>
                <button onClick={() => setRegisterError(null)} className="text-rose-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 環境変数ガイダンスバナー */}
        {!isConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Supabase または Gemini API の初期設定が必要です</p>
              <p><code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">.env.local</code> を確認してください。</p>
            </div>
          </div>
        )}

        {/* 2カラム構成レイアウト: 左 75% (メイン) + 右 25% (サイドバー) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ========================================================= */}
          {/* 左側: メインコンテンツ (約75%)                            */}
          {/* ========================================================= */}
          <main className="w-full lg:flex-1 min-w-0 space-y-5">
            {/* 自然言語検索バー (コンパクト化) */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
              <form onSubmit={(e) => handleSearch(e)} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="自然言語で検索: 商用利用できる効果音、Unity対応の3Dモデル..."
                    disabled={isSearching}
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition shadow-xs disabled:opacity-50 shrink-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>判定中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI検索</span>
                    </>
                  )}
                </button>
              </form>

              {/* クイック検索サジェストチップ (1行スクロール可能) */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0 uppercase tracking-wider">
                  例:
                </span>
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSearch(undefined, q)}
                    disabled={isSearching}
                    className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 transition whitespace-nowrap text-[11px]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </section>

            {/* アクティブなフィルター表示 & リセットバー */}
            {(searchResults !== null || selectedCategory !== null || selectedTag !== null) && (
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" />
                    絞り込み中:
                  </span>

                  {/* 検索クエリバッジ */}
                  {activeQuery && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium">
                      AI検索: "{activeQuery}"
                      <button onClick={handleClearSearch} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {/* カテゴリバッジ */}
                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium">
                      <span>カテゴリ: {getCategoryIcon(selectedCategory)} {selectedCategory}</span>
                      <button onClick={() => setSelectedCategory(null)} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {/* タグバッジ */}
                  {selectedTag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium">
                      タグ: #{selectedTag}
                      <button onClick={() => setSelectedTag(null)} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleResetAllFilters}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-rose-600 dark:hover:text-rose-400 hover:underline shrink-0"
                >
                  すべての条件をクリア
                </button>
              </div>
            )}

            {/* 一覧件数ヘッダー */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {searchResults !== null ? 'AI検索結果' : 'ブックマーク一覧'}
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {displayedItems.length} 件
                </span>
              </div>
            </div>

            {/* 独立スクロール化されたカード一覧エリア */}
            <div className="h-[calc(100vh-270px)] sm:h-[calc(100vh-280px)] overflow-y-auto pr-1.5 custom-scrollbar">
              {/* ローディング状態 */}
              {isLoadingList && bookmarks.length === 0 && (
                <div className="py-12 text-center">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
                  <p className="text-xs text-slate-500">保存済みリソースを読み込んでいます...</p>
                </div>
              )}

              {/* 0件状態 (ブックマーク未登録) */}
              {!isLoadingList && bookmarks.length === 0 && (
                <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-6">
                  <FileCode2 className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    ブックマークがまだ登録されていません
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
                    右上の「＋ 新規リソース登録」ボタンから素材サイトやWebリソースのURLを登録してみましょう。
                  </p>
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    最初のURLを登録する
                  </button>
                </div>
              )}

              {/* 0件状態 (検索・絞り込みでヒットなし) */}
              {!isLoadingList && bookmarks.length > 0 && displayedItems.length === 0 && (
                <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    条件に合致するリソースが見つかりませんでした
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
                    検索ワードやカテゴリのフィルター条件を変更するか、クリアしてください。
                  </p>
                  <button
                    onClick={handleResetAllFilters}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  >
                    すべてのフィルターをリセット
                  </button>
                </div>
              )}

              {/* コンパクト化されたカードグリッド (横3列: xl:grid-cols-3) */}
              {displayedItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5 pb-6">
                  {displayedItems.map((item) => {
                    const searchItem = item as SearchResultItem;
                    const commStyle = getCommercialBadgeStyle(item.commercial_use);
                    const CommIcon = commStyle.icon;
                    const isUseCasesOpen = Boolean(expandedUseCases[item.id]);

                    return (
                      <div
                        key={item.id}
                        className="group relative flex flex-col justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800/90 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-2xs hover:shadow-sm transition-all duration-150 overflow-hidden"
                      >
                        {/* 自然言語検索時: AI推薦理由ハイライト (コンパクト) */}
                        {searchItem.recommendationReason && (
                          <div className="p-2 sm:p-2.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-b border-indigo-100 dark:border-indigo-900/60">
                            <div className="flex items-start gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                                    推薦理由
                                  </span>
                                  {searchItem.matchScore && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                      {searchItem.matchScore}%
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight font-medium line-clamp-2">
                                  {searchItem.recommendationReason}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                          <div>
                            {/* 上部バッジ ＆ 削除ボタン */}
                            <div className="flex items-center justify-between gap-1.5 mb-2">
                              <div className="flex flex-wrap items-center gap-1 min-w-0">
                                {/* カテゴリ変更ドロップダウンバッジ */}
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={normalizeCategory(item.category)}
                                    onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                                    className="appearance-none pl-2 pr-4 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[130px] truncate"
                                    title="クリックしてカテゴリを変更"
                                  >
                                    {CATEGORY_DEFINITIONS.map((c) => (
                                      <option
                                        key={c.name}
                                        value={c.name}
                                        className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 py-1"
                                      >
                                        {c.icon} {c.name}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400 absolute right-1 pointer-events-none opacity-60" />
                                </div>

                                {/* 商用利用バッジ */}
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border ${commStyle.bg}`}
                                  title={item.commercial_use}
                                >
                                  <CommIcon className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate max-w-[110px]">{item.commercial_use}</span>
                                </span>
                              </div>

                              {/* 削除ボタン */}
                              <button
                                onClick={() => handleDelete(item.id, item.title)}
                                disabled={deletingId === item.id}
                                className="opacity-40 group-hover:opacity-100 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-0.5 rounded transition shrink-0"
                                title="削除"
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* タイトル */}
                            <div className="mb-2">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.url}
                                className="group/link inline-flex items-center gap-1 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                              >
                                <span className="line-clamp-1">{item.title}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover/link:opacity-100 shrink-0 transition text-slate-400 group-hover/link:text-indigo-500" />
                              </a>
                            </div>

                            {/* 概要: 最大2行 (line-clamp-2) でコンパクト表示 */}
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug mb-2 line-clamp-2">
                              {item.summary}
                            </p>

                            {/* おすすめ用途のアコーディオン (初期状態は非表示) */}
                            {item.use_cases && item.use_cases.length > 0 && (
                              <div className="mb-2">
                                <button
                                  type="button"
                                  onClick={() => toggleUseCase(item.id)}
                                  className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80 transition"
                                >
                                  <span className="flex items-center gap-1">
                                    <Briefcase className="w-3 h-3 text-indigo-500" />
                                    用途を見る ({item.use_cases.length}件)
                                  </span>
                                  {isUseCasesOpen ? (
                                    <ChevronUp className="w-3 h-3 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>

                                {/* 展開コンテンツ */}
                                {isUseCasesOpen && (
                                  <ul className="mt-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside animate-fadeIn">
                                    {item.use_cases.map((uc, idx) => (
                                      <li key={idx} className="line-clamp-2">
                                        {uc}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>

                          {/* タグ一覧 (クリックでそのタグで絞り込み可能) */}
                          {item.tags && item.tags.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {item.tags.map((t, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedTag(t)}
                                  className={`text-[10px] px-1.5 py-0.2 rounded transition ${
                                    selectedTag === t
                                      ? 'bg-indigo-600 text-white font-semibold'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                                  }`}
                                  title={`#${t} で絞り込み`}
                                >
                                  #{t}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {/* ========================================================= */}
          {/* 右側: サイドバー (約25% / 横幅 lg:w-64 xl:w-72)            */}
          {/* sticky top-6 でスクロール追従                             */}
          {/* ========================================================= */}
          <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-6 space-y-4">
            {/* カテゴリ一覧カード */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  カテゴリ一覧
                </h3>
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    解除
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {/* すべてボタン */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                    selectedCategory === null
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>すべてのカテゴリ</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      selectedCategory === null
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {bookmarks.length}
                  </span>
                </button>

                {/* 8つの規定カテゴリボタン一覧 */}
                {categorizedList.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  const hasItems = cat.count > 0;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                      title={`${cat.name} (${cat.subtext})`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition group ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : hasItems
                          ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 pr-1.5">
                        <span className="text-sm shrink-0 leading-none">{cat.icon}</span>
                        <div className="flex flex-col text-left truncate">
                          <span className="truncate leading-tight font-medium">{cat.name}</span>
                          <span
                            className={`text-[9px] truncate transition leading-tight ${
                              isSelected
                                ? 'text-white/80'
                                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'
                            }`}
                          >
                            {cat.subtext}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 transition ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : hasItems
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 人気タグクイックフィルター */}
            {topTags.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    人気タグ
                  </h3>
                  {selectedTag && (
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      解除
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {topTags.map(({ tag, count }) => {
                    const isSelected = selectedTag === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(isSelected ? null : tag)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>#{tag}</span>
                        <span className="text-[10px] opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ミニ統計 & ガイド */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-400">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
                リソース統計
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-indigo-100/60 dark:border-indigo-900/40 text-center">
                <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">{bookmarks.length}</div>
                  <div className="text-[10px] text-slate-400">登録リソース</div>
                </div>
                <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-lg">
                  <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {categorizedList.filter((c) => c.count > 0).length} / 8
                  </div>
                  <div className="text-[10px] text-slate-400">登録カテゴリ</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
