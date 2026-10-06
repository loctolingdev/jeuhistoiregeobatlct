import { useMemo, useState } from "react";
import { GOODS, type Good } from "../data";
import { useGame } from "../store";
import { audio } from "../audio";

const CONTAINERS: Good["container"][] = ["tonneaux", "sacs", "caisses", "petits contenants"];
const ROUND1 = ["vin", "cafe", "sucre", "indigo", "farine", "epices"];
const ORIGINS = [
  { id: "vin", answer: "Vignobles bordelais" },
  { id: "sucre", answer: "Antilles" },
  { id: "bois", answer: "Forêts des Landes" },
  { id: "sel", answer: "Marais salants" },
];

/** Mini-jeu commercial : 1) ranger les marchandises, 2) équilibrer, 3) associer les origines. */
export function CargoGame({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [step, setStep] = useState<"pack" | "balance" | "origins" | "done">(
    s.cargoRound1 ? "origins" : "pack",
  );
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [side, setSide] = useState<Record<string, "avant" | "arriere">>({});
  const [origins, setOrigins] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const goods = ROUND1.map((id) => GOODS.find((g) => g.id === id)!);
  const shuffledOrigins = useMemo(
    () => [...ORIGINS].sort(() => Math.random() - 0.5).map((o) => o.answer),
    [],
  );

  const weightOf = (k: "avant" | "arriere") =>
    goods.filter((g) => side[g.id] === k).reduce((a, g) => a + g.weight, 0);

  return (
    <div className="ui-scrim" onPointerDown={(e) => e.stopPropagation()}>
      <div className="ui-panel ui-panel--wide">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-display text-3xl">📦 Cargaison du navire</h2>
            <p className="text-sm text-muted-foreground">
              {step === "pack" && "Étape 1 : choisissez une marchandise, puis le bon contenant."}
              {step === "balance" &&
                "Étape 2 : répartissez la cargaison entre l'avant et l'arrière pour équilibrer le navire."}
              {step === "origins" &&
                "Épreuve 2 : associez chaque marchandise à son lieu d'origine."}
              {step === "done" && "Mission réussie !"}
            </p>
          </div>
          <button className="ui-icon-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="mt-4">
          {step === "pack" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                {goods.map((g) => (
                  <button
                    key={g.id}
                    className={
                      selected === g.id
                        ? "ui-chip ui-chip--on justify-between"
                        : "ui-chip justify-between"
                    }
                    onClick={() => setSelected(g.id)}
                  >
                    <span>
                      {g.emoji} {g.name.toUpperCase()}
                    </span>
                    <span className="opacity-70">{assign[g.id] ? `→ ${assign[g.id]}` : "…"}</span>
                  </button>
                ))}
              </div>
              <div className="grid content-start gap-2">
                {CONTAINERS.map((c) => (
                  <button
                    key={c}
                    disabled={!selected}
                    className="ui-btn"
                    onClick={() => {
                      if (!selected) return;
                      setAssign({ ...assign, [selected]: c });
                      setSelected(null);
                      audio.blip(520);
                    }}
                  >
                    {c === "tonneaux" ? "🛢️" : c === "sacs" ? "👝" : c === "caisses" ? "📦" : "🏺"}{" "}
                    {c}
                  </button>
                ))}
                <button
                  className="ui-btn ui-btn--primary mt-2"
                  disabled={Object.keys(assign).length < goods.length}
                  onClick={() => {
                    const wrong = goods.filter((g) => assign[g.id] !== g.container);
                    if (wrong.length) {
                      setMsg(
                        `À revoir : ${wrong.map((w) => w.name).join(", ")}. Indice : le vin voyage en tonneaux, le café en sacs.`,
                      );
                      audio.blip(220);
                    } else {
                      setMsg(null);
                      setStep("balance");
                      audio.blip(784);
                    }
                  }}
                >
                  Vérifier le rangement
                </button>
              </div>
            </div>
          )}

          {step === "balance" && (
            <div>
              <div className="grid gap-2">
                {goods.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 fiche">
                    <span>
                      {g.emoji} {g.name}{" "}
                      <span className="text-muted-foreground">
                        ({assign[g.id]}, poids {g.weight})
                      </span>
                    </span>
                    <span className="flex gap-1">
                      {(["avant", "arriere"] as const).map((k) => (
                        <button
                          key={k}
                          className={side[g.id] === k ? "ui-chip ui-chip--on" : "ui-chip"}
                          onClick={() => setSide({ ...side, [g.id]: k })}
                        >
                          {k === "avant" ? "Avant" : "Arrière"}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="balance-meter mt-4">
                <span>Avant : {weightOf("avant")}</span>
                <div className="balance-track">
                  <div
                    className="balance-needle"
                    style={{
                      transform: `rotate(${(weightOf("arriere") - weightOf("avant")) * 5}deg)`,
                    }}
                  />
                </div>
                <span>Arrière : {weightOf("arriere")}</span>
              </div>
              <button
                className="ui-btn ui-btn--primary mt-4 w-full"
                disabled={Object.keys(side).length < goods.length}
                onClick={() => {
                  if (Math.abs(weightOf("avant") - weightOf("arriere")) <= 1) {
                    setMsg("Navire chargé !");
                    s.finishCargoRound(1);
                    s.learnFact(
                      "Une cargaison devait être bien répartie dans la cale pour que le navire reste stable en mer.",
                    );
                    audio.blip(880);
                    setStep("origins");
                  } else {
                    setMsg("Le navire penche ! Rééquilibrez la cargaison (écart maximal : 1).");
                    audio.blip(220);
                  }
                }}
              >
                Valider l'équilibre
              </button>
            </div>
          )}

          {step === "origins" && (
            <div className="grid gap-2">
              {ORIGINS.map((o) => {
                const g = GOODS.find((x) => x.id === o.id)!;
                return (
                  <div
                    key={o.id}
                    className="fiche flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-display text-lg">
                      {g.emoji} {g.name}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {shuffledOrigins.map((a) => (
                        <button
                          key={a}
                          className={origins[o.id] === a ? "ui-chip ui-chip--on" : "ui-chip"}
                          onClick={() => setOrigins({ ...origins, [o.id]: a })}
                        >
                          {a}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
              <button
                className="ui-btn ui-btn--primary mt-2"
                disabled={Object.keys(origins).length < ORIGINS.length}
                onClick={() => {
                  const ok = ORIGINS.every((o) => origins[o.id] === o.answer);
                  if (ok) {
                    s.finishCargoRound(2);
                    s.learnFact(
                      "Les marchandises du port venaient d'horizons variés : vignobles locaux, forêts des Landes, marais salants et colonies lointaines.",
                    );
                    setMsg(null);
                    setStep("done");
                    audio.blip(988);
                  } else {
                    setMsg(
                      "Certaines associations sont fausses. Consultez les fiches des marchandises dans le journal.",
                    );
                    audio.blip(220);
                  }
                }}
              >
                Valider les origines
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="py-6 text-center">
              <p className="font-display text-4xl">Navire chargé !</p>
              <p className="font-display mt-2 text-2xl text-primary">Mission réussie</p>
              <button className="ui-btn ui-btn--primary mt-6" onClick={onClose}>
                Retourner au port
              </button>
            </div>
          )}

          {msg && <p className="fiche mt-4">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
