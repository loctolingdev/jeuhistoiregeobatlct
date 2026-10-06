/**
 * Contenu pédagogique et données du monde.
 * Reconstitution pédagogique : les formulations prudentes sont volontaires.
 */

export type ZoneId = "quais" | "entrepot" | "maison" | "chantier" | "navire" | "ilot";

export interface Zone {
  id: ZoneId;
  name: string;
  x: number;
  z: number;
  radius: number;
  fact: string;
}

export const ZONES: Zone[] = [
  {
    id: "quais",
    name: "Les quais",
    x: 0,
    z: 2,
    radius: 26,
    fact: "Au XVIIIᵉ siècle, les quais de Bordeaux étaient un lieu de travail très animé : chargement, déchargement et pesée des marchandises.",
  },
  {
    id: "entrepot",
    name: "L'entrepôt",
    x: -34,
    z: 16,
    radius: 11,
    fact: "Les marchandises étaient entreposées près du port avant d'être revendues ou réexpédiées vers d'autres villes.",
  },
  {
    id: "maison",
    name: "Maison de négociant",
    x: 34,
    z: 17,
    radius: 11,
    fact: "Les négociants organisaient et finançaient des échanges commerciaux, souvent depuis un bureau proche du port.",
  },
  {
    id: "chantier",
    name: "Le chantier naval",
    x: -54,
    z: 0,
    radius: 13,
    fact: "Construire et réparer les navires demandait beaucoup de bois, de cordages et le savoir-faire des charpentiers de marine.",
  },
  {
    id: "navire",
    name: "Le navire marchand",
    x: 6,
    z: -22,
    radius: 22,
    fact: "Un navire marchand transportait des marchandises très variées, rangées avec soin dans la cale pour équilibrer le bateau.",
  },
  {
    id: "ilot",
    name: "L'îlot Bonnaffé",
    x: 9,
    z: 22,
    radius: 9,
    fact: "L'îlot Bonnaffé est un ensemble d'immeubles bordelais en pierre que le négociant François Bonnaffé fit construire à la fin du XVIIIᵉ siècle : une façon d'afficher sa réussite commerciale.",
  },
];

export interface Good {
  id: string;
  name: string;
  emoji: string;
  origin: string;
  usage: string;
  transport: string;
  importance: string;
  container: "tonneaux" | "sacs" | "caisses" | "petits contenants";
  weight: number;
}

export const GOODS: Good[] = [
  {
    id: "vin",
    name: "Vin",
    emoji: "🍷",
    origin: "Vignobles de la région bordelaise",
    usage: "Boisson, produit d'exportation majeur",
    transport: "Tonneaux de bois roulés sur les quais",
    importance: "Le vin est l'un des produits les plus associés au commerce bordelais.",
    container: "tonneaux",
    weight: 3,
  },
  {
    id: "sucre",
    name: "Sucre",
    emoji: "🍬",
    origin: "Colonies antillaises (selon les sources disponibles)",
    usage: "Alimentation, confiserie, raffinage en ville",
    transport: "Caisses et barriques",
    importance:
      "Le sucre colonial arrivait dans les ports atlantiques puis était raffiné et revendu.",
    container: "caisses",
    weight: 3,
  },
  {
    id: "cafe",
    name: "Café",
    emoji: "☕",
    origin: "Colonies tropicales",
    usage: "Boisson, produit de revente",
    transport: "Sacs de toile",
    importance: "Produit dit « colonial » très recherché dans l'Europe du XVIIIᵉ siècle.",
    container: "sacs",
    weight: 2,
  },
  {
    id: "indigo",
    name: "Indigo",
    emoji: "🟦",
    origin: "Cultures tropicales",
    usage: "Teinture bleue pour les textiles",
    transport: "Petits contenants protégés",
    importance: "Colorant précieux, vendu en petites quantités de grande valeur.",
    container: "petits contenants",
    weight: 1,
  },
  {
    id: "cacao",
    name: "Cacao",
    emoji: "🍫",
    origin: "Régions tropicales d'Amérique",
    usage: "Préparation du chocolat, alors boisson de luxe",
    transport: "Sacs et caisses",
    importance: "Produit rare et coûteux, réservé aux plus riches.",
    container: "sacs",
    weight: 2,
  },
  {
    id: "epices",
    name: "Épices",
    emoji: "🌶️",
    origin: "Commerce lointain, souvent par plusieurs intermédiaires",
    usage: "Cuisine, conservation, pharmacie",
    transport: "Petits contenants fermés",
    importance: "Très grande valeur pour un faible volume.",
    container: "petits contenants",
    weight: 1,
  },
  {
    id: "farine",
    name: "Farine",
    emoji: "🌾",
    origin: "Campagnes environnantes",
    usage: "Alimentation de la ville et des équipages",
    transport: "Sacs",
    importance: "Marchandise du quotidien, indispensable aux voyages longs.",
    container: "sacs",
    weight: 2,
  },
  {
    id: "textiles",
    name: "Textiles",
    emoji: "🧵",
    origin: "Ateliers français et européens",
    usage: "Vêtements, échanges commerciaux",
    transport: "Caisses et ballots",
    importance: "Produits manufacturés souvent exportés par les ports.",
    container: "caisses",
    weight: 2,
  },
  {
    id: "bois",
    name: "Bois",
    emoji: "🪵",
    origin: "Forêts des environs (dont les Landes)",
    usage: "Construction navale, tonneaux, bâtiments",
    transport: "Empilé sur les quais et les charrettes",
    importance: "Sans bois, ni navires ni tonneaux : une ressource stratégique.",
    container: "caisses",
    weight: 3,
  },
  {
    id: "sel",
    name: "Sel",
    emoji: "🧂",
    origin: "Marais salants de la côte atlantique",
    usage: "Conservation des aliments à bord",
    transport: "Sacs et tonneaux",
    importance: "Essentiel pour conserver la nourriture pendant les longues traversées.",
    container: "tonneaux",
    weight: 2,
  },
];

export interface Npc {
  id: string;
  name: string;
  job: string;
  model: string;
  x: number;
  z: number;
  rotation: number;
  lines: string[];
  fact: string;
}

export const NPCS: Npc[] = [
  {
    id: "bonnaffe",
    name: "François Bonnaffé",
    job: "Négociant et armateur",
    model: "character-male-f",
    x: 9,
    z: 21,
    rotation: Math.PI,
    lines: [
      "Bonjour ! Je suis François Bonnaffé. Je suis né dans le Tarn et je suis venu chercher fortune à Bordeaux.",
      "Je suis négociant et armateur : j'achète des navires, je les équipe et je les envoie commercer, surtout avec les îles des Antilles.",
      "Le commerce avec les colonies enrichit Bordeaux, mais il repose sur le travail forcé des esclaves dans les plantations. Il ne faut pas l'oublier.",
      "Avec mes bénéfices, je ferai bâtir de beaux immeubles en pierre : on les appellera plus tard l'« îlot Bonnaffé ».",
    ],
    fact: "François Bonnaffé (1723-1809) fut l'un des plus riches négociants-armateurs de Bordeaux ; sa fortune venait surtout du commerce avec les Antilles, fondé sur l'esclavage.",
  },
  {
    id: "negociant",
    name: "Monsieur Delaunay",
    job: "Négociant",
    model: "character-male-c",
    x: 12,
    z: 4,
    rotation: Math.PI,
    lines: [
      "Bonjour, jeune personne. Je suis négociant : j'achète, je vends et j'organise des expéditions.",
      "Mon métier consiste à financer un voyage, à trouver des marchandises et à les revendre avec bénéfice.",
      "Je ne navigue pas moi-même : j'écris des lettres, je tiens des registres et je discute des prix.",
      "François Bonnaffé, dont vous voyez le nom sur ce navire, était un négociant et armateur bordelais du XVIIIᵉ siècle.",
    ],
    fact: "Les négociants organisaient et finançaient des échanges commerciaux ; ils tenaient des registres et correspondaient avec d'autres ports.",
  },
  {
    id: "marin",
    name: "Gaspard",
    job: "Marin",
    model: "character-male-a",
    x: -4,
    z: -6,
    rotation: Math.PI * 0.9,
    lines: [
      "Je suis marin. J'ai passé des mois en mer, dans un espace où l'on dort serrés les uns contre les autres.",
      "À bord, tout a un nom : le pont, la cale, le gouvernail, les mâts, les voiles et les cordages.",
      "La navigation était difficile : tempêtes, maladies, eau douce à économiser, nourriture salée.",
      "Montez donc à bord par la passerelle : on voit mieux depuis le pont.",
    ],
    fact: "La vie à bord d'un navire marchand était rude : équipage nombreux, espace réduit, voyages parfois très longs.",
  },
  {
    id: "docker",
    name: "Mathieu",
    job: "Ouvrier du port (portefaix)",
    model: "character-male-e",
    x: -14,
    z: -4,
    rotation: Math.PI * 1.15,
    lines: [
      "Moi, je charge et je décharge. Toute la journée, des tonneaux, des sacs et des caisses.",
      "On roule les tonneaux plutôt que de les porter : c'est plus sûr pour le dos et pour la marchandise.",
      "Les grues de bois et les palans aidaient à hisser les charges les plus lourdes.",
      "Attention où vous marchez : les quais sont glissants et encombrés.",
    ],
    fact: "Le chargement et le déchargement se faisaient à la force des bras, avec des palans et des grues en bois.",
  },
  {
    id: "charpentier",
    name: "Maître Ruel",
    job: "Charpentier de marine",
    model: "character-male-d",
    x: -52,
    z: -2,
    rotation: Math.PI * 0.6,
    lines: [
      "Bienvenue au chantier. Ici, on construit et on répare les coques.",
      "Le chêne servait à la charpente, le pin aux mâts, le chanvre aux cordages, et le goudron à l'étanchéité.",
      "Un navire abîmé revient toujours : le sel, les vers et les tempêtes travaillent le bois.",
      "Sans nous, aucun négociant ne pourrait expédier quoi que ce soit.",
    ],
    fact: "Les charpentiers de marine utilisaient surtout du chêne, du pin, du chanvre et du goudron pour construire et réparer les navires.",
  },
  {
    id: "vin",
    name: "Dame Perrine",
    job: "Marchande de vin",
    model: "character-female-a",
    x: -30,
    z: 12,
    rotation: Math.PI * 1.1,
    lines: [
      "Le vin, ici, c'est bien plus qu'une boisson : c'est un commerce.",
      "On le met en tonneaux, on le charge, on l'expédie vers d'autres ports européens.",
      "Chaque tonneau est vérifié et marqué avant de partir. Un tonneau mal fermé, c'est de l'argent perdu.",
      "Le vin est l'un des produits les plus associés à l'économie bordelaise.",
    ],
    fact: "Le vin de la région était mis en tonneaux puis exporté par le port, ce qui en faisait un pilier de l'économie locale.",
  },
];

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export const QUIZ: QuizQuestion[] = [
  {
    q: "Quel était le métier de François Bonnaffé ?",
    options: ["Médecin", "Négociant et armateur", "Architecte", "Soldat"],
    answer: 1,
    explain:
      "François Bonnaffé était un négociant et armateur bordelais du XVIIIᵉ siècle : il finançait et organisait des expéditions maritimes.",
  },
  {
    q: "Dans quoi transportait-on surtout le vin ?",
    options: [
      "Des sacs de toile",
      "Des tonneaux de bois",
      "Des bouteilles en caisse",
      "Des jarres de terre",
    ],
    answer: 1,
    explain:
      "Le tonneau était le contenant habituel : solide, étanche et facile à rouler sur les quais.",
  },
  {
    q: "Que fait un charpentier de marine ?",
    options: [
      "Il vend des marchandises",
      "Il construit et répare les navires",
      "Il commande l'équipage",
      "Il tient les registres",
    ],
    answer: 1,
    explain: "Le charpentier de marine travaille le bois de la coque, des mâts et des ponts.",
  },
  {
    q: "Où rangeait-on la cargaison d'un navire marchand ?",
    options: ["Sur les voiles", "Dans la cale", "Dans les mâts", "Sur le gouvernail"],
    answer: 1,
    explain:
      "La cale, sous le pont, recevait la cargaison ; il fallait bien la répartir pour équilibrer le navire.",
  },
  {
    q: "Pourquoi le sel était-il important à bord ?",
    options: [
      "Pour conserver les aliments",
      "Pour peindre la coque",
      "Pour fabriquer les voiles",
      "Pour alourdir le navire",
    ],
    answer: 0,
    explain:
      "Sans réfrigération, le sel permettait de conserver viandes et poissons pendant la traversée.",
  },
  {
    q: "L'indigo servait surtout à…",
    options: [
      "Teindre les textiles en bleu",
      "Parfumer le vin",
      "Calfater les coques",
      "Fabriquer du verre",
    ],
    answer: 0,
    explain: "L'indigo était un colorant bleu très recherché par les ateliers textiles.",
  },
  {
    q: "Qui finançait et organisait une expédition commerciale ?",
    options: ["Le charpentier", "Le portefaix", "Le négociant-armateur", "Le tonnelier"],
    answer: 2,
    explain:
      "Le négociant-armateur réunissait les fonds, affrétait le navire et choisissait les marchandises.",
  },
  {
    q: "À quoi ressemblait le port de Bordeaux au XVIIIᵉ siècle ?",
    options: [
      "Un port de plaisance calme",
      "Un port commercial très animé",
      "Un port militaire fermé",
      "Un simple village de pêcheurs",
    ],
    answer: 1,
    explain:
      "Le port était un centre commercial actif : navires, charrettes, marchandises empilées et métiers très variés.",
  },
];

export const LEVELS = [
  { name: "Débutant", min: 0 },
  { name: "Apprenti marchand", min: 120 },
  { name: "Négociant", min: 300 },
  { name: "Grand négociant", min: 550 },
];

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "premier-pas", icon: "🏆", name: "Premier pas", desc: "Arriver dans le port" },
  { id: "marin", icon: "⚓", name: "Marin", desc: "Monter à bord d'un navire" },
  { id: "marchand", icon: "📦", name: "Marchand", desc: "Identifier 5 marchandises" },
  { id: "explorateur", icon: "🧭", name: "Explorateur", desc: "Découvrir les 6 lieux de la carte" },
  { id: "historien", icon: "📚", name: "Historien", desc: "Réussir le quiz historique" },
  { id: "negociant", icon: "💰", name: "Négociant", desc: "Terminer toutes les missions" },
];

export const ABOUT_TEXT =
  "Ce jeu est une reconstitution numérique à vocation éducative du port de Bordeaux au XVIIIᵉ siècle. Certains éléments visuels et certaines mécaniques sont imaginés afin de rendre l'expérience interactive.";

export const SHIP_NOTE =
  "Reconstitution pédagogique inspirée des grands navires marchands du XVIIIᵉ siècle. Les détails exacts du navire de François Bonnaffé ne sont pas connus.";
