export const PERSONA_MAP = {
  builder: {
    id: "builder",
    label: "作っている人の視点",
    description: "起業、開発、制作",
    promptInstruction: `このユーザーは「何かを作っている人」（起業・開発・制作）です。
接続を生成する際は、以下の角度を優先してください：
- 創業ストーリーや起業家の思考プロセス
- プロダクト設計の具体事例（社名、数字付き）
- 技術的ブレイクスルーや発明のきっかけ
ユーザーにとっての「確かに！」は「これ自分のプロダクトに使えるかも」です。`,
    searchAngle: "startup product design engineering breakthrough innovation",
  },
  grower: {
    id: "grower",
    label: "伸ばしている人の視点",
    description: "マーケ、営業、運用",
    promptInstruction: `このユーザーは「何かを伸ばしている人」（マーケ・営業・運用）です。
接続を生成する際は、以下の角度を優先してください：
- 施策事例と数字付きケーススタディ
- 成長ハック、グロース戦略の具体例
- ユーザー獲得やリテンションの手法
ユーザーにとっての「確かに！」は「これウチでも試せるかも」です。`,
    searchAngle: "marketing growth hack case study metrics conversion",
  },
  researcher: {
    id: "researcher",
    label: "深めている人の視点",
    description: "研究、学習、専門職",
    promptInstruction: `このユーザーは「何かを深めている人」（研究・学習・専門職）です。
接続を生成する際は、以下の角度を優先してください：
- 学術研究や理論の具体的引用
- モデル、フレームワーク、実験結果
- 歴史的な知見や科学的根拠
ユーザーにとっての「確かに！」は「この現象にはこんな理論があったのか」です。`,
    searchAngle: "research theory model study academic evidence",
  },
  creator: {
    id: "creator",
    label: "表現している人の視点",
    description: "デザイン、文章、音楽",
    promptInstruction: `このユーザーは「何かを表現している人」（デザイン・文章・音楽）です。
接続を生成する際は、以下の角度を優先してください：
- アート作品や表現技法の具体事例
- クリエイターの制作プロセスや思考法
- 異分野の表現方法からの着想
ユーザーにとっての「確かに！」は「この表現方法、自分の作品に活かせそう」です。`,
    searchAngle: "art design creative process technique expression",
  },
} as const;

export type PersonaId = keyof typeof PERSONA_MAP;

export function getPersonaLabels(ids: string[]): string[] {
  return ids.map((id) => PERSONA_MAP[id as PersonaId]?.label ?? id);
}
