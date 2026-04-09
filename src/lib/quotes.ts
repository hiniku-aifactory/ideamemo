export interface Quote {
  text: string;
  author: string;
}

export const quotes: Quote[] = [
  {
    text: "An idea is nothing more nor less than a new combination of old elements.",
    author: "James Webb Young",
  },
  {
    text: "Creativity is just connecting things.",
    author: "Steve Jobs",
  },
  {
    text: "The creation of something new is not accomplished by the intellect but by the play instinct.",
    author: "Carl Jung",
  },
  {
    text: "Discovery consists of seeing what everybody has seen and thinking what nobody has thought.",
    author: "Albert Szent-Györgyi",
  },
  {
    text: "The best way to have a good idea is to have a lot of ideas.",
    author: "Linus Pauling",
  },
  {
    text: "Chance favors the connected mind.",
    author: "Steven Johnson",
  },
  {
    text: "To create is to recombine.",
    author: "François Jacob",
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be kindled.",
    author: "Plutarch",
  },
];

export function getRandomQuote(): Quote {
  return quotes[Math.floor(Math.random() * quotes.length)];
}
