// All the words in the game's story. Change any of them!
// Use \n to start a new line.

const STORY = {
  // The game's name, shown big on the title screen
  title: "Bob's Adventure",
  subtitle: "Bob's way back to Ruby",

  // The story at the start. Each one is a picture screen.
  intro: [
    "Bob and Ruby were going to get married.",
    "But Mayor Frank kept telling Bob to go to work.\nBob didn't listen.",
    "So Frank shoved Bob down into the caves!",
    "Now Bob has to find his way back to Ruby,\nand collect wedding presents on the way.",
  ],

  // What Frank shouts
  frankSays: "Go to work!",

  // The wedding at the end. {n} becomes the number of presents.
  endingTitle: "Bob made it back to Ruby!",
  endingPresents: "Bob brought Ruby {n} wedding presents!",
  frankAtWedding: "Go to work! ...after the wedding.",
};

if (typeof module !== "undefined") module.exports = { STORY };
