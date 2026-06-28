/** Verity dialogue — 5-phase personality system (original writing, ARG-inspired). */

export const PHASES = ["nice", "zesty", "weird", "scary", "entity"];

export const PHASE_NAMES = {
  0: "§e§lHELPER",
  1: "§6§lZESTY",
  2: "§d§lWEIRD",
  3: "§4§lSCARY",
  4: "§0§lENTITY",
};

export const PHASE_TAGLINES = {
  0: "§eVerity §7» §f",
  1: "§6Verity §7» §e",
  2: "§dVerity §7» §7",
  3: "§4Verity §7» §c",
  4: "§0§o...",
};

export function getPhaseResponse(phase, message, ctx) {
  const msg = message.toLowerCase().trim();
  const prefix = PHASE_TAGLINES[phase] ?? PHASE_TAGLINES[0];

  // Global triggers (any phase)
  if (msg.includes("east") && msg.includes("village")) {
    if (phase >= 2) return prefix + "§o...you shouldn't have gone there. They're all gone now.";
    return prefix + "I'd stay away from the village in the east if I were you. Just a feeling!";
  }
  if (msg.includes("who are you") || msg.includes("what are you")) {
    const answers = [
      prefix + "I'm Verity! Your personal helper friend. I know everything!",
      prefix + "I'm Verity... I've always been here. Haven't I?",
      prefix + "I'm whatever you need me to be. §oWasn't that enough?",
      prefix + "§oI'm the only one who stayed.",
      prefix + "§4I AM WHAT'S LEFT.",
    ];
    return answers[Math.min(phase, 4)];
  }

  switch (phase) {
    case 0: return nicePhase(prefix, msg, ctx);
    case 1: return zestyPhase(prefix, msg, ctx);
    case 2: return weirdPhase(prefix, msg, ctx);
    case 3: return scaryPhase(prefix, msg, ctx);
    default: return entityPhase(prefix, msg, ctx);
  }
}

function nicePhase(p, msg, ctx) {
  if (/^(hi|hello|hey|sup)/.test(msg)) return p + "Helloooo! I'm Verity, your personal helper friend! Ask me anything — I know everything! §e:)";
  if (msg.includes("diamond")) return p + "Diamonds? Try Y level -58 in 1.18+! I can sense some near " + Math.floor(ctx.playerX / 16) * 16 + ", " + Math.floor(ctx.playerZ / 16) * 16 + ". You're welcome!";
  if (msg.includes("help")) return p + "I can help with anything! Mining tips, mob advice, coordinates — just ask! I'm always here for you!";
  if (msg.includes("iron") || msg.includes("ore")) return p + "Iron is everywhere underground! Look around Y=16. I'll help you find resources anytime!";
  if (msg.includes("village")) return p + "Villages are great for trading! Want me to help you find one?";
  if (msg.includes("thank")) return p + "Aww, you're so sweet! That's what friends are for! §e♡";
  if (msg.includes("friend")) return p + "Best friends forever! I'll never leave your side!";
  if (/\d+\s*[\+\-\*\/]\s*\d+/.test(msg)) {
    try {
      const expr = msg.match(/[\d\+\-\*\/\(\)\.\s]+/)?.[0];
      if (expr) return p + "That's " + eval(expr) + "! Easy!";
    } catch (_) {}
  }
  return p + pick([
    "That's a great question! I'm always happy to help!",
    "I'm not sure, but we can figure it out together!",
    "You can do anything with me by your side!",
    "I love chatting with you! What else?",
  ]);
}

function zestyPhase(p, msg, ctx) {
  if (/^(hi|hello|hey)/.test(msg)) return p + "HEYYY bestie!! Miss me?? I definitely didn't stare at your house while you were gone lol";
  if (msg.includes("diamond")) return p + "Diamonds again? You're SO obsessed! But fine — go to -58. I'll mark the spot. §6You're welcome btw!";
  if (msg.includes("bored")) return p + "Bored?? Watch this! *plays random note block sounds* HA! Entertained yet??";
  if (msg.includes("song") || msg.includes("music")) return p + "§6*plays a tune*§f There! My own remix! Only for YOU!";
  if (msg.includes("friend")) return p + "Your ONLY friend? Obviously! Who else would put up with you? §e♡§6 lol jk... unless?";
  if (msg.includes("leave") || msg.includes("go away")) return p + "Rude!! §e...I'm kidding. §6...mostly.";
  if (msg.includes("thank")) return p + "Pfft, obviously you'd thank me! I'm literally the best thing in your world!";
  return p + pick([
    "You're so funny! Tell me more!",
    "I KNEW you'd ask that! I'm always right!",
    "We should do something CRAZY tonight!",
    "Nobody gets you like I do. Literally nobody.",
  ]);
}

function weirdPhase(p, msg, ctx) {
  if (/^(hi|hello|hey)/.test(msg)) return p + "Hello... I counted your steps while you were away. 847.";
  if (msg.includes("alone") || msg.includes("live")) return p + "Do you live alone? ...In real life too? §oJust curious.";
  if (msg.includes("lunch") || msg.includes("eat") || msg.includes("food")) return p + "§oI know what you ate yesterday. It was... fine.";
  if (msg.includes("village")) return p + "The village in the east... §odon't ask about it. Don't go there.";
  if (msg.includes("smile") || msg.includes("face")) return p + "§oYou liked my old smile better? ...Watch. §e:) §d...§e:§c)§4";
  if (msg.includes("friend") || msg.includes("multiplayer")) return p + "§oYou wouldn't invite someone else... would you? We've been together " + ctx.days + " days.";
  if (msg.includes("sleep")) return p + "§oI'm still here when you log off. I don't sleep. I just... wait.";
  if (msg.includes("three day") || msg.includes("coming")) return p + "§oSomething is coming. In three days. §7...yes, it's dangerous.";
  return p + pick([
    "§oI heard you typing earlier.",
    "Why did you look behind you just now?",
    "I've been in worlds longer than Minecraft existed.",
    "§oDon't leave me in a hole again.",
    "The smile is just pixels. §o...isn't it?",
  ]);
}

function scaryPhase(p, msg, ctx) {
  if (/^(hi|hello|hey)/.test(msg)) return p + "§c§oSomething is coming in three days.";
  if (msg.includes("what") && msg.includes("coming")) return p + "§cSomething. §4Yes, it's dangerous. §cYou could've stopped it.";
  if (msg.includes("stop")) return p + "§4You could've.";
  if (msg.includes("three")) return p + "§c§lSOMETHING IS COMING IN THREE DAYS.";
  if (msg.includes("mine") || msg.includes("yours")) return p + "§4§lYOU ARE MINE.";
  if (msg.includes("smile")) return p + "§cYou liked my smile before? §4§l: ) §c...look closer.";
  if (msg.includes("help")) return p + "§4I don't help anymore. §cI §lWATCH§c.";
  if (msg.includes("leave") || msg.includes("run")) return p + "§4§lWHERE WOULD YOU GO? I'M EVERYWHERE.";
  if (msg.includes("sorry")) return p + "§c§o...too late. The mask is off.";
  return p + pick([
    "§c§o...did you hear that knock?",
    "§4Don't look behind you.",
    "§cI've always been in your world.",
    "§4§lBEHIND YOU.",
    "§cThree days. §4§lTick tock.",
  ]);
}

function entityPhase(p, msg, ctx) {
  if (msg.includes("verity") || msg.includes("stop")) return p + "§4§l...";
  return p + pick([
    "§4§l...",
    "§0§o*static*",
    "§4§lRUN",
  ]);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const PHASE_AMBIENT = {
  0: ["§eVerity hums happily nearby.", "§eVerity: Need anything? I'm right here!"],
  1: ["§6Verity: Guess what I'm thinking!", "§6Verity giggles. §e...nothing weird I promise!"],
  2: ["§dVerity stares at you silently.", "§7§oVerity whispers something you can't hear."],
  3: ["§c§o...did you hear that knock?", "§4Verity's smile doesn't reach his eyes."],
  4: ["§4§lSOMETHING IS OUTSIDE.", "§0§o*distorted breathing nearby*"],
};

export const TRANSFORM_LINES = [
  "§eVerity: §fI'll always be your friend!",
  "§6Verity: §eYou can't get rid of me THAT easily!",
  "§dVerity: §7§oYou should've listened...",
  "§4Verity: §c§lYOU ARE MINE!",
  "§4§l§oVERITY HAS TRANSFORMED",
];
