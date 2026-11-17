// Sample library for the user-guide screenshots. Every song, artist and lyric
// here is fictional and written for this purpose, so the public docs never
// reproduce copyrighted lyrics.

const now = Date.now();

type SectionSeed = { label: string; type: string; body: string };

function song(
  id: string,
  title: string,
  artist: string,
  sections: SectionSeed[],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    title,
    artist,
    language: "pt",
    scrimOpacity: 35,
    createdAt: now,
    updatedAt: now,
    sections: sections.map((s, i) => ({
      id: `${id}-sec${i + 1}`,
      songId: id,
      label: s.label,
      type: s.type,
      body: s.body,
      sortOrder: i,
      repeatCount: 1,
    })),
    ...extra,
  };
}

const verse = (label: string, body: string): SectionSeed => ({ label, type: "verse", body });
const chorus = (body: string): SectionSeed => ({ label: "Refrão", type: "chorus", body });

export const songs = [
  song("s-ao-teu-encontro", "Ao Teu Encontro", "Grupo Ágape", [
    verse("Estrofe 1", "Venho ao teu encontro\ncom tudo o que eu sou,\nabro o coração\npra ouvir a tua voz"),
    chorus("Aqui estou, Senhor,\nfala que eu te ouço"),
  ]),
  song("s-agua-viva", "Água Viva", "Banda Semear", [
    verse("Estrofe 1", "Corre um rio de água viva\nonde a sede tem fim,\nquem beber dessa fonte\nnunca mais terá sede assim"),
    chorus("Água viva, vem fluir,\nlava e renova o meu viver"),
  ]),
  song("s-bendito", "Bendito Seja o Teu Nome", "Vozes do Vale", [
    verse("Estrofe 1", "Desde o nascer do sol\naté o seu poente,\nbendito seja o teu nome\nno meio da tua gente"),
  ]),
  song("s-esperanca", "Canção da Esperança", "Banda Semear", [
    verse("Estrofe 1", "Mesmo quando a chuva vem\ne o vento sopra contra mim,\nhá uma canção de esperança\nque não tem fim"),
    chorus("Eu espero em ti,\nminha esperança está em ti"),
  ]),
  song("s-caminho", "Caminho de Paz", "Vozes do Vale", [
    verse("Estrofe 1", "Guia os meus passos\npor caminhos de paz,\nonde a tua mão me leva\no medo fica para trás"),
    chorus("Caminho de paz,\né contigo que eu vou"),
  ]),
  song("s-ceu", "Céu Aberto", "Grupo Ágape", [
    verse("Estrofe 1", "Há um céu aberto\nsobre a nossa adoração,\ndesce a tua presença\nsobre esta reunião"),
  ]),
  song("s-fiel", "Fiel em Todo Tempo", "Ministério Aliança", [
    verse("Estrofe 1", "No vale ou na montanha\ntu és o mesmo, Senhor,\nfiel em todo tempo,\nconstante é o teu amor"),
  ]),
  song(
    "s-graca",
    "Graça que Alcança",
    "Ministério Aliança",
    [
      verse(
        "Estrofe 1",
        "Quando o caminho parece longo\ne a noite insiste em não passar,\na tua graça me alcança\ne me ensina a recomeçar",
      ),
      chorus("Graça que alcança, amor sem fim,\nmão que levanta e cuida de mim"),
      verse(
        "Estrofe 2",
        "Em cada passo eu vejo a luz\nque vem do alto me guiar,\nteu nome é força e esperança,\nem ti eu posso descansar",
      ),
      { label: "Ponte", type: "bridge", body: "Eu vou cantar, eu vou confiar,\ntua graça vai me sustentar" },
    ],
    {
      author: "Ana Ribeiro e Paulo Matos",
      ccliNumber: "1234567",
      copyright: "© 2021 Exemplo Music",
      backgroundId: "m-aurora",
      backgroundMode: "media",
    },
  ),
  song("s-luz", "Luz do Amanhecer", "Coral Boas Novas", [
    verse("Estrofe 1", "Raiou a luz do amanhecer,\num novo dia pra louvar,\ntuas misericórdias\nnão param de chegar"),
    chorus("Luz do amanhecer,\nbrilha sobre nós"),
  ]),
  song("s-maos", "Mãos que Acolhem", "Ministério Aliança", [
    verse("Estrofe 1", "Mãos que acolhem o cansado,\nbraços que abrigam o que chorou,\nassim é o teu cuidado,\nassim é o teu amor"),
  ]),
  song("s-novo-dia", "Novo Dia", "Coral Boas Novas", [
    verse("Estrofe 1", "Hoje é um novo dia,\no passado ficou pra trás,\nem ti tudo se renova,\nem ti encontro paz"),
  ]),
];

export const songById = (id?: string) => songs.find((s) => s.id === id);

// ── Media ────────────────────────────────────────────────────────────────────

export const media = [
  { id: "m-aurora", fileName: "fundo-aurora.svg", displayName: "Fundo Aurora", kind: "image", mimeType: "image/png", width: 1920, height: 1080, byteSize: 845_000, createdAt: now - 9e6, updatedAt: now - 9e6 },
  { id: "m-noite", fileName: "fundo-noite.svg", displayName: "Fundo Noite Estrelada", kind: "image", mimeType: "image/png", width: 1920, height: 1080, byteSize: 612_000, createdAt: now - 8e6, updatedAt: now - 8e6 },
  { id: "m-oferta", fileName: "oferta.svg", displayName: "Dízimos e Ofertas", kind: "image", mimeType: "image/png", width: 1920, height: 1080, byteSize: 402_000, createdAt: now - 7e6, updatedAt: now - 7e6 },
  { id: "m-cartaz", fileName: "cartaz.svg", displayName: "Conferência de Jovens", kind: "image", mimeType: "image/jpeg", width: 1920, height: 1080, byteSize: 530_000, createdAt: now - 6e6, updatedAt: now - 6e6 },
  { id: "m-abertura", fileName: "abertura.mp4", thumbnailFile: "thumb-abertura.svg", displayName: "Abertura do Culto", kind: "video", mimeType: "video/mp4", width: 1920, height: 1080, durationMs: 95_000, byteSize: 48_200_000, createdAt: now - 5e6, updatedAt: now - 5e6 },
  { id: "m-vinheta", fileName: "vinheta.webm", thumbnailFile: "thumb-vinheta.svg", displayName: "Vinheta da Contagem", kind: "video", mimeType: "video/webm", width: 1920, height: 1080, durationMs: 30_000, byteSize: 9_700_000, createdAt: now - 4e6, updatedAt: now - 4e6 },
  { id: "m-avisos", fileName: "avisos-da-semana", thumbnailFile: "thumb-avisos.svg", displayName: "Avisos da Semana", kind: "presentation", mimeType: "application/pdf", width: 1920, height: 1080, byteSize: 2_300_000, slideCount: 6, createdAt: now - 3e6, updatedAt: now - 3e6 },
];

// ── Sets ─────────────────────────────────────────────────────────────────────

/** Today at HH:MM, `minutesFromNow` ahead, for a schedule that is still pending. */
function scheduleAhead(minutesFromNow: number) {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

export function buildSets(opts: { scheduled: boolean }) {
  const domingo = {
    id: "set-domingo",
    name: "Culto de Domingo",
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: "i-cd", setId: "set-domingo", itemType: "countdown", sortOrder: 0,
        countdownConfig: {
          name: "Abertura",
          target: { kind: "duration", durationMs: 300_000 },
          message: "O culto começa em…",
          endBehavior: "advanceSet",
          position: "center",
          messageScale: 100,
          digitsScale: 100,
          ...(opts.scheduled ? { scheduledStart: scheduleAhead(25) } : {}),
        },
      },
      { id: "i-video", setId: "set-domingo", itemType: "media", mediaId: "m-abertura", mediaKind: "video", sortOrder: 1,
        mediaOptions: { loop: false, mute: false, autoAdvanceOnEnd: true } },
      { id: "i-graca", setId: "set-domingo", itemType: "song", songId: "s-graca", sortOrder: 2 },
      { id: "i-luz", setId: "set-domingo", itemType: "song", songId: "s-luz", sortOrder: 3 },
      { id: "i-caminho", setId: "set-domingo", itemType: "song", songId: "s-caminho", sortOrder: 4 },
      { id: "i-preta", setId: "set-domingo", itemType: "blank", sortOrder: 5, notes: "Oração e leitura bíblica" },
      { id: "i-avisos", setId: "set-domingo", itemType: "slide_show", mediaId: "m-avisos", mediaKind: "presentation", sortOrder: 6 },
      { id: "i-esperanca", setId: "set-domingo", itemType: "song", songId: "s-esperanca", sortOrder: 7 },
      {
        id: "i-camera", setId: "set-domingo", itemType: "web_view", sortOrder: 8,
        webviewConfig: {
          mode: "rtsp",
          url: "rtsp://192.168.0.50:554/stream1",
          rtspTransport: "udp",
          profiles: [
            { id: "p-principal", label: "Principal (4K)", url: "rtsp://192.168.0.50:554/stream1", rtspTransport: "udp" },
            { id: "p-reduzido", label: "Reduzido (1080p)", url: "rtsp://192.168.0.50:554/stream2", rtspTransport: "udp" },
          ],
          activeProfileId: "p-reduzido",
        },
      },
    ],
  };
  const quarta = {
    id: "set-quarta", name: "Culto de Quarta", createdAt: now, updatedAt: now,
    items: [
      { id: "q1", setId: "set-quarta", itemType: "song", songId: "s-novo-dia", sortOrder: 0 },
      { id: "q2", setId: "set-quarta", itemType: "song", songId: "s-fiel", sortOrder: 1 },
      { id: "q3", setId: "set-quarta", itemType: "blank", sortOrder: 2 },
      { id: "q4", setId: "set-quarta", itemType: "song", songId: "s-maos", sortOrder: 3 },
    ],
  };
  const ensaio = {
    id: "set-ensaio", name: "Ensaio do Louvor", createdAt: now, updatedAt: now,
    items: [
      { id: "e1", setId: "set-ensaio", itemType: "song", songId: "s-ceu", sortOrder: 0 },
      { id: "e2", setId: "set-ensaio", itemType: "song", songId: "s-agua-viva", sortOrder: 1 },
      { id: "e3", setId: "set-ensaio", itemType: "song", songId: "s-bendito", sortOrder: 2 },
    ],
  };
  return [domingo, quarta, ensaio];
}

// ── Slides, as the backend builds them (max 4 lines each) ────────────────────

type Slide = { lines: string[]; sectionLabel: string; sectionId: string };

export function slidesForItem(item: { itemType: string; songId?: string; id: string }): Slide[] {
  if (item.itemType === "song") {
    const s = songById(item.songId);
    if (!s) return [];
    const credit = (s as { author?: string }).author ?? s.artist;
    const slides: Slide[] = [{ lines: [s.title, `(${credit})`], sectionLabel: "__title__", sectionId: `${s.id}-title` }];
    for (const sec of s.sections) {
      const lines = sec.body.split("\n");
      for (let i = 0; i < lines.length; i += 4) {
        slides.push({ lines: lines.slice(i, i + 4), sectionLabel: sec.label, sectionId: sec.id });
      }
    }
    slides.push({ lines: [], sectionLabel: "__blackout__", sectionId: `${s.id}-blackout` });
    return slides;
  }
  if (item.itemType === "blank") return [{ lines: [], sectionLabel: "__blackout__", sectionId: `${item.id}-b` }];
  if (item.itemType === "slide_show") {
    return Array.from({ length: 6 }, (_, i) => ({ lines: [], sectionLabel: "", sectionId: String(i) }));
  }
  return [{ lines: [], sectionLabel: "", sectionId: `${item.id}-0` }];
}

// ── Other screens ────────────────────────────────────────────────────────────

const day = (daysAgo: number) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
};

export const ccliRows = [
  { playedOn: day(3), title: "Graça que Alcança", author: "Ana Ribeiro e Paulo Matos", ccliNumber: "1234567", copyright: "© 2021 Exemplo Music" },
  { playedOn: day(3), title: "Luz do Amanhecer", author: "Coral Boas Novas" },
  { playedOn: day(3), title: "Caminho de Paz", author: "Vozes do Vale" },
  { playedOn: day(10), title: "Canção da Esperança", author: "Banda Semear" },
  { playedOn: day(10), title: "Graça que Alcança", author: "Ana Ribeiro e Paulo Matos", ccliNumber: "1234567", copyright: "© 2021 Exemplo Music" },
  { playedOn: day(17), title: "Novo Dia", author: "Coral Boas Novas" },
  { playedOn: day(17), title: "Fiel em Todo Tempo", author: "Ministério Aliança" },
];

export const holyricsFile = {
  songs: [
    { title: "Alegria do Senhor", artist: "Grupo Ágape", sections: [{ number: 1, description: "Estrofe 1", text: "A alegria do Senhor\né a nossa força" }] },
    { title: "Luz do Amanhecer", artist: "Coral Boas Novas", sections: [{ number: 1, description: "Estrofe 1", text: "Raiou a luz do amanhecer" }] },
    { title: "Deus de Promessas Fiéis", artist: "Banda Semear", sections: [{ number: 1, description: "Estrofe 1", text: "Tuas promessas não falham" }] },
    { title: "Em Tua Presença", artist: "Ministério Aliança", sections: [{ number: 1, description: "Estrofe 1", text: "Em tua presença eu quero estar" }] },
    { title: "Caminho de Paz", artist: "Vozes do Vale", sections: [{ number: 1, description: "Estrofe 1", text: "Guia os meus passos" }] },
    { title: "Sempre Presente", artist: "Coral Boas Novas", sections: [{ number: 1, description: "Estrofe 1", text: "Sempre presente, sempre fiel" }] },
  ],
  duplicateIndices: [1, 4],
};

export const importPlan = {
  kind: "set",
  schemaVersion: 1,
  counts: { songs: 4, sections: 13, sets: 1, setItems: 6, media: 2, settings: 0 },
  items: [
    { artifactType: "set", id: "a-set", title: "Culto de Jovens", conflict: null, defaultAction: "copy" },
    { artifactType: "song", id: "s-graca", title: "Graça que Alcança", conflict: "sameId", defaultAction: "skip" },
    { artifactType: "song", id: "a-novo-dia", title: "Novo Dia", conflict: "sameTitleArtist", defaultAction: "skip" },
    { artifactType: "song", id: "a-hino", title: "Hino da Juventude", conflict: null, defaultAction: "copy" },
    { artifactType: "song", id: "a-tempo", title: "Tempo de Recomeçar", conflict: null, defaultAction: "copy" },
    { artifactType: "media", id: "m-aurora", title: "Fundo Aurora", conflict: "sameId", defaultAction: "skip" },
    { artifactType: "media", id: "a-cartaz", title: "Cartaz do Acampamento", conflict: null, defaultAction: "copy" },
  ],
};

export const monitors = [
  { name: "\\\\.\\DISPLAY1", width: 1920, height: 1080, x: 0, y: 0, scaleFactor: 1, isPrimary: true },
  { name: "\\\\.\\DISPLAY2", width: 1920, height: 1080, x: 1920, y: 0, scaleFactor: 1, isPrimary: false },
  { name: "\\\\.\\DISPLAY3", width: 1366, height: 768, x: 3840, y: 0, scaleFactor: 1, isPrimary: false },
];

export const monitorNames = {
  "name:\\\\.\\DISPLAY1": "Notebook",
  "name:\\\\.\\DISPLAY2": "Projetor",
  "name:\\\\.\\DISPLAY3": "TV lateral",
};

export const keyBindings = {
  bindings: {
    advanceSlide: [{ key: " ", ctrl: false, shift: false, alt: false }, { key: "ArrowRight", ctrl: false, shift: false, alt: false }],
    previousSlide: [{ key: "ArrowLeft", ctrl: false, shift: false, alt: false }],
    blank: [{ key: "b", ctrl: false, shift: false, alt: false }],
    freeze: [{ key: "f", ctrl: false, shift: false, alt: false }],
    exitPresentation: [{ key: "Escape", ctrl: false, shift: false, alt: false }],
    jumpToItem1: [{ key: "1", ctrl: false, shift: false, alt: false }],
    jumpToItem2: [{ key: "2", ctrl: false, shift: false, alt: false }],
    jumpToItem3: [{ key: "3", ctrl: false, shift: false, alt: false }],
    jumpToItem4: [{ key: "4", ctrl: false, shift: false, alt: false }],
    jumpToItem5: [{ key: "5", ctrl: false, shift: false, alt: false }],
    jumpToItem6: [{ key: "6", ctrl: false, shift: false, alt: false }],
    jumpToItem7: [{ key: "7", ctrl: false, shift: false, alt: false }],
    jumpToItem8: [{ key: "8", ctrl: false, shift: false, alt: false }],
    jumpToItem9: [{ key: "9", ctrl: false, shift: false, alt: false }],
    countdownPause: [{ key: "p", ctrl: false, shift: false, alt: false }],
    openPresentationWindow: [{ key: "p", ctrl: true, shift: false, alt: false }],
    focusSearch: [{ key: "f", ctrl: true, shift: false, alt: false }],
  },
};
