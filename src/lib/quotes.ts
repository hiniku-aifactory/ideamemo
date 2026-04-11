export interface Quote {
  text: string;
  author: string;
  ja?: string;
}

export const quotes: Quote[] = [
  // 英語（ja訳あり）
  {
    text: "An idea is nothing more nor less than a new combination of old elements.",
    author: "James Webb Young",
    ja: "アイデアとは、古い要素の新しい組み合わせに他ならない。",
  },
  {
    text: "Creativity is just connecting things.",
    author: "Steve Jobs",
    ja: "創造性とは、物事をつなぐことだ。",
  },
  {
    text: "The creation of something new is not accomplished by the intellect but by the play instinct.",
    author: "Carl Jung",
    ja: "新しいものの創造は知性によってではなく、遊戯本能によって成し遂げられる。",
  },
  {
    text: "Discovery consists of seeing what everybody has seen and thinking what nobody has thought.",
    author: "Albert Szent-Györgyi",
    ja: "発見とは、誰もが見ているものを見て、誰も考えなかったことを考えることだ。",
  },
  {
    text: "The best way to have a good idea is to have a lot of ideas.",
    author: "Linus Pauling",
    ja: "良いアイデアを持つ最善の方法は、たくさんのアイデアを持つことだ。",
  },
  {
    text: "Chance favors the connected mind.",
    author: "Steven Johnson",
    ja: "偶然は、つながった精神に味方する。",
  },
  {
    text: "To create is to recombine.",
    author: "François Jacob",
    ja: "創造するとは、組み合わせ直すことだ。",
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be kindled.",
    author: "Plutarch",
    ja: "精神は満たされる器ではなく、灯される炎だ。",
  },
  {
    text: "Imagination is more important than knowledge.",
    author: "Albert Einstein",
    ja: "想像力は知識より重要だ。",
  },
  {
    text: "Logic will get you from A to B. Imagination will take you everywhere.",
    author: "Albert Einstein",
    ja: "論理はAからBへ連れていく。想像力はどこへでも連れていく。",
  },
  {
    text: "Everything you can imagine is real.",
    author: "Pablo Picasso",
    ja: "想像できることはすべて現実だ。",
  },
  {
    text: "The secret to creativity is knowing how to hide your sources.",
    author: "Pablo Picasso",
    ja: "創造性の秘密は、出典を隠す方法を知ることだ。",
  },
  {
    text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    ja: "我々は繰り返し行うことの産物だ。卓越性とは行為ではなく、習慣である。",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    ja: "偉大な仕事をする唯一の方法は、自分のやることを愛することだ。",
  },
  {
    text: "In the middle of every difficulty lies opportunity.",
    author: "Albert Einstein",
    ja: "すべての困難の中に、機会が潜んでいる。",
  },
  {
    text: "Innovation distinguishes between a leader and a follower.",
    author: "Steve Jobs",
    ja: "イノベーションがリーダーとフォロワーを分ける。",
  },
  {
    text: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    author: "Nelson Mandela",
    ja: "生きることの最大の栄光は、決して倒れないことではなく、倒れるたびに立ち上がることにある。",
  },
  {
    text: "Do not go where the path may lead, go instead where there is no path and leave a trail.",
    author: "Ralph Waldo Emerson",
    ja: "道があるところに行くな。道がないところへ行き、軌跡を残せ。",
  },
  {
    text: "What you get by achieving your goals is not as important as what you become by achieving your goals.",
    author: "Henry David Thoreau",
    ja: "目標を達成することで得るものより、達成する過程でなるものの方が重要だ。",
  },
  {
    text: "The two most important days in your life are the day you were born and the day you find out why.",
    author: "Mark Twain",
    ja: "人生で最も重要な2日は、生まれた日と、なぜ生まれたかを知る日だ。",
  },

  // 日本の偉人
  {
    text: "芸術は爆発だ。",
    author: "岡本太郎",
  },
  {
    text: "自分の中に毒を持て。あなたは常識人間を捨てろ。",
    author: "岡本太郎",
  },
  {
    text: "人生に意味などない。あなたが意味をつくるのだ。",
    author: "岡本太郎",
  },
  {
    text: "面白いことをやろうと思ったら、無駄なことをたくさんやらなければならない。",
    author: "宮崎駿",
  },
  {
    text: "自分が変わらなければ、相手も変わらない。",
    author: "宮崎駿",
  },
  {
    text: "素直な心とは、自分の非を認め、何事にも学ぼうとする心である。",
    author: "松下幸之助",
  },
  {
    text: "失敗の原因を素直に認識し、それを繰り返さないことが成功への近道である。",
    author: "松下幸之助",
  },
  {
    text: "三回失敗したら、三回やり直せばいい。",
    author: "本田宗一郎",
  },
  {
    text: "チャレンジして失敗を恐れるよりも、何もしないことを恐れろ。",
    author: "本田宗一郎",
  },
  {
    text: "映画は観客のものではなく、あなたのものだ。あなたの心の中に映画がある。",
    author: "黒澤明",
  },
  {
    text: "人間が一番怖い。",
    author: "黒澤明",
  },
  {
    text: "知ることは考えることの始まりに過ぎない。",
    author: "福沢諭吉",
  },
  {
    text: "独立の気力なき者は必ず人に依頼す。",
    author: "福沢諭吉",
  },
];

export function getRandomQuote(): Quote {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
