export const PREDEFINED_CATEGORIES = [
  '効果音/BGM',
  'アイコン',
  '写真/画像',
  '3Dモデル',
  'カラー',
  'フォント',
  'テクスチャー',
  'オーバーレイ',
] as const;

export type CategoryName = (typeof PREDEFINED_CATEGORIES)[number];

export interface CategoryDefinition {
  name: CategoryName;
  icon: string;
  subtext: string;
  description: string;
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    name: '効果音/BGM',
    icon: '🎵',
    subtext: '効果音・BGM・オーディオ素材',
    description: '効果音、BGM、オーディオ、SE素材など',
  },
  {
    name: 'アイコン',
    icon: '🎨',
    subtext: 'UIアイコン・シンボル',
    description: 'UIアイコン、ベクターピクトグラム、シンボルなど',
  },
  {
    name: '写真/画像',
    icon: '🖼️',
    subtext: '写真・イラスト・グラフィック',
    description: '写真、イラスト、CG画像、グラフィック素材など',
  },
  {
    name: '3Dモデル',
    icon: '🧊',
    subtext: '3Dモデル・FBX・ローポリ',
    description: '3Dモデル、FBX/GLTF/OBJ、ローポリ素材など',
  },
  {
    name: 'カラー',
    icon: '🌈',
    subtext: '配色ツール、パレットなど',
    description: '配色ツール、カラーパレット、カラーチャート、グラデーションなど',
  },
  {
    name: 'フォント',
    icon: '🔤',
    subtext: 'フリーフォント、Webフォントなど',
    description: 'フリーフォント、Webフォント、タイポグラフィなど',
  },
  {
    name: 'テクスチャー',
    icon: '🧱',
    subtext: '3D用PBR素材、背景パターンなど',
    description: '3D用PBR素材、マテリアル、背景パターン、シームレス柄など',
  },
  {
    name: 'オーバーレイ',
    icon: '✨',
    subtext: '動画エフェクト、フィルムグレイン、配信素材など',
    description: '動画エフェクト、フィルムグレイン、配信オーバーレイ、パーティクルなど',
  },
];

/**
 * カテゴリ名に対応する絵文字アイコンを取得
 */
export const getCategoryIcon = (categoryName?: string | null): string => {
  if (!categoryName) return '📁';
  const found = CATEGORY_DEFINITIONS.find((c) => c.name === categoryName);
  return found ? found.icon : '📁';
};

/**
 * カテゴリ名に対応する説明・サブテキストを取得
 */
export const getCategorySubtext = (categoryName?: string | null): string => {
  if (!categoryName) return '';
  const found = CATEGORY_DEFINITIONS.find((c) => c.name === categoryName);
  return found ? found.subtext : '';
};

/**
 * 入力されたカテゴリ文字列を8つの規定カテゴリに厳密に正規化
 */
export const normalizeCategory = (categoryName?: string | null): CategoryName => {
  if (!categoryName) return '写真/画像';
  const trimmed = categoryName.trim();

  // 完全一致
  const exact = CATEGORY_DEFINITIONS.find((c) => c.name === trimmed);
  if (exact) return exact.name;

  // 絵文字や修飾が付いている場合の救済（例: "🎵 効果音/BGM", "🌈 カラーサイト"）
  for (const cat of CATEGORY_DEFINITIONS) {
    if (trimmed.includes(cat.name) || trimmed.includes(cat.icon)) {
      return cat.name;
    }
  }

  // キーワードマッチ
  const lower = trimmed.toLowerCase();
  if (lower.includes('sound') || lower.includes('audio') || lower.includes('bgm') || lower.includes('効果音') || lower.includes('音楽')) {
    return '効果音/BGM';
  }
  if (lower.includes('icon') || lower.includes('アイコン')) {
    return 'アイコン';
  }
  if (lower.includes('3d') || lower.includes('mesh') || lower.includes('model') || lower.includes('モデル')) {
    return '3Dモデル';
  }
  if (lower.includes('color') || lower.includes('colour') || lower.includes('palette') || lower.includes('配色') || lower.includes('カラー')) {
    return 'カラー';
  }
  if (lower.includes('font') || lower.includes('フォント') || lower.includes('書体')) {
    return 'フォント';
  }
  if (lower.includes('texture') || lower.includes('pbr') || lower.includes('テクスチャ') || lower.includes('パターン')) {
    return 'テクスチャー';
  }
  if (lower.includes('overlay') || lower.includes('effect') || lower.includes('エフェクト') || lower.includes('オーバーレイ') || lower.includes('グレイン')) {
    return 'オーバーレイ';
  }
  if (lower.includes('photo') || lower.includes('image') || lower.includes('illust') || lower.includes('写真') || lower.includes('画像') || lower.includes('イラスト')) {
    return '写真/画像';
  }

  return '写真/画像';
};
