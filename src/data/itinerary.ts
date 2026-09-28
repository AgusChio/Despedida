export const moments = [
  {
    id: "tarde",
    step: "01",
    nav: "Tarde",
    when: "Sábado 10 de octubre",
    title: "Tarde de chicas",
    lead: "El plan es sorpresa. La única pista: llegá de blanco, a las 18.",
    details: ["18:00", "Deán Funes 244", "De blanco"],
  },
  {
    id: "escapada",
    step: "02",
    nav: "Escapada",
    when: "Domingo 11 y lunes 12",
    title: "Escapadita sorpresa",
    lead: "Escapada sorpresa.",
    details: [],
  },
  {
    id: "cafe",
    step: "03",
    nav: "Cafecito",
    when: "Lunes 12 de octubre",
    title: "El último cafecito",
    lead: "Desayuno juntas, sin apuro, y la vuelta a casa.",
    details: [],
  },
] as const;

export type MomentId = (typeof moments)[number]["id"];
