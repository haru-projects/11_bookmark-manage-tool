import { GoogleGenAI, Type } from '@google/genai';
import { Bookmark, BookmarkAnalysis } from '@/types/bookmark';
import { PREDEFINED_CATEGORIES, normalizeCategory } from '@/lib/categories';

const apiKey = (process.env.GEMINI_API_KEY || '').trim();

export const isGeminiConfigured = (): boolean => {
  return Boolean(apiKey && apiKey !== 'your-gemini-api-key');
};

const getGenAIClient = () => {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY が設定されていません。.env.local に正しいAPIキーを設定してください。');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Gemini API呼び出し用のヘルパー（過負荷503/429時のリトライおよびモデルフォールバック対応）
 */
async function callGeminiWithFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateFn: (modelName: string) => Promise<any>
) {
  // 優先順位: gemini-2.5-flash -> gemini-3.6-flash
  const models = ['gemini-2.5-flash', 'gemini-3.6-flash'];
  let lastError: unknown = null;

  for (const model of models) {
    // 各モデルで最大2回試行
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await generateFn(model);
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const isTemporary = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE');

        if (isTemporary && attempt < 1) {
          // 1秒待ってリトライ
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        // 他のエラー、または試行回数上限なら次のモデルへフォールバック
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Jina Readerで取得したWebページのMarkdownから、
 * Gemini 2.5 Flash の Structured Outputs を使用してメタ情報を抽出する
 */
export async function analyzeWebContent(markdown: string, originalUrl: string): Promise<BookmarkAnalysis> {
  const ai = getGenAIClient();

  // トークン上限や処理効率を考慮し、Markdownを適切な長さにトリミング
  const trimmedMarkdown = markdown.length > 20000 ? markdown.slice(0, 20000) + '\n...(以下省略)' : markdown;

  const prompt = `
あなたはWebリソース・素材・開発ツールの分析エキスパートです。
以下のWebページのMarkdownコンテンツ（URL: ${originalUrl}）を分析し、指定されたJSONスキーマに従って日本語で情報を抽出・要約してください。

【抽出ルール】
1. title: サイト名やツール・サービスの名前、公式タイトル（簡潔に）。ブログ記事やまとめ記事、特定拡張機能ページの場合は「サイト名 - コンテンツ名」のようにサイト名・ブランド名も含めて簡潔に記述してください（例: "コリス - 日本語フリーフォントまとめ"、"Chromeウェブストア - WhatFont"）。
2. summary: どのようなサイト・リソースか、何ができるかをわかりやすく2〜3文（100〜200文字程度）で要約。
3. category: 最も適したカテゴリを必ず以下の8つのいずれか1つ（最も近いもの）に厳密に分類してください。
   - "効果音/BGM": 効果音、BGM、オーディオ、SE素材など
   - "アイコン": UIアイコン、ベクターピクトグラム、シンボルなど
   - "写真/画像": 写真、イラスト、CG画像、グラフィック素材など
   - "3Dモデル": 3Dモデル、FBX/GLTF/OBJ、ローポリ素材など
   - "カラー": 配色ツール、パレット、カラーチャート、グラデーションなど
   - "フォント": フリーフォント、Webフォント、タイポグラフィなど
   - "テクスチャー": 3D用PBR素材、マテリアル、背景パターン、シームレス柄など
   - "オーバーレイ": 動画エフェクト、フィルムグレイン、配信オーバーレイ、パーティクルなど
   ※上記8つの名称のいずれかのみを出力してください（絵文字やカッコは含めず、カテゴリ名文字列のみを出力）。
4. tags: 関連するキーワードや技術・形式・特徴のタグ（3〜7個程度、例: ["CC0", "Unity", "FBX", "Blender", "無料"]）。
5. useCases: 具体的にどのようなシチュエーションや制作で使えるか（2〜4項目、例: ["ゲームのプロトタイプ制作", "商用YouTube動画のBGM", "Webサイトのヒーローセクション装飾"]）。
6. commercialUse: 商用利用の可否やライセンス情報を明確に記述（例: "商用利用可（クレジット表記不要）", "商用利用可（CC-BY クレジット必須）", "個人利用のみ（非商用）", "一部有料・ライセンス要確認" など）。

【対象Webコンテンツ】
${trimmedMarkdown}
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'サイト名・サービス名または素材名',
      },
      summary: {
        type: Type.STRING,
        description: 'リソースの概要・特徴の日本語要約',
      },
      category: {
        type: Type.STRING,
        enum: [...PREDEFINED_CATEGORIES],
        description: '分類カテゴリ（8つの規定カテゴリから最も適したものを厳密に1つ選択）',
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'キーワードやタグの配列',
      },
      useCases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '具体的な用途や使えるシチュエーションの配列',
      },
      commercialUse: {
        type: Type.STRING,
        description: '商用利用の可否やライセンス・利用規約の状態',
      },
    },
    required: ['title', 'summary', 'category', 'tags', 'useCases', 'commercialUse'],
  };

  const response = await callGeminiWithFallback(async (modelName) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('Gemini APIから有効な応答が得られませんでした。');
  }

  const result = JSON.parse(responseText) as BookmarkAnalysis;
  result.category = normalizeCategory(result.category);
  return result;
}

export interface AIRankingResult {
  id: string;
  matchScore: number;
  recommendationReason: string;
}

/**
 * ユーザーの自然言語クエリに基づき、保存済みブックマーク群から関連度・推薦理由をGeminiで判定する
 */
export async function searchBookmarksWithAI(
  query: string,
  bookmarks: Bookmark[]
): Promise<AIRankingResult[]> {
  if (bookmarks.length === 0) {
    return [];
  }

  const ai = getGenAIClient();

  const candidateList = bookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    category: b.category,
    summary: b.summary,
    tags: b.tags,
    use_cases: b.use_cases,
    commercial_use: b.commercial_use,
  }));

  const prompt = `
ユーザーが素材・Webリソースを探しています。以下の検索クエリと保存済みブックマーク一覧を比較し、
ユーザーの意図に合致するリソースを抽出して、関連度スコア（1〜100）の高い順に並べてください。
合致するリソースのみを返し、まったく無関係なものは結果に含めないでください。

【検索クエリ】
"${query}"

【保存済みブックマーク候補】
${JSON.stringify(candidateList, null, 2)}

【評価基準】
- 商用利用に関する要望（例:「商用利用できる」「フリー」）がある場合、commercial_use や tags を厳密に評価してください。
- 用途や技術（例:「Unity」「3D」「効果音」）がある場合、category、tags、use_cases、summary を確認してください。
- 各候補について、なぜユーザーの検索意図にマッチしているか、推薦理由（recommendationReason）を魅力的かつ端的に日本語（1〜2文）で記述してください。
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      matches: {
        type: Type.ARRAY,
        description: '関連度順に並んだマッチ候補のリスト',
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: 'ブックマークのID',
            },
            matchScore: {
              type: Type.INTEGER,
              description: 'クエリとの関連度スコア（1〜100）',
            },
            recommendationReason: {
              type: Type.STRING,
              description: 'ユーザーのクエリに対する推薦理由・おすすめポイント',
            },
          },
          required: ['id', 'matchScore', 'recommendationReason'],
        },
      },
    },
    required: ['matches'],
  };

  const response = await callGeminiWithFallback(async (modelName) => {
    return await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
  });

  const responseText = response.text;
  if (!responseText) {
    return [];
  }

  try {
    const parsed = JSON.parse(responseText) as { matches: AIRankingResult[] };
    return parsed.matches.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    console.error('Failed to parse Gemini search ranking:', error);
    return [];
  }
}
