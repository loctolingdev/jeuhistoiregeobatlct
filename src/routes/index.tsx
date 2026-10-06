import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "../auth/AuthProvider";
import { GameCanvas } from "../game/GameCanvas";

function HomePage() {
  return (
    <AuthProvider>
      <GameCanvas />
    </AuthProvider>
  );
}

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bordeaux 1750 — Le port au XVIIIᵉ siècle" },
      {
        name: "description",
        content:
          "Jeu 3D éducatif : explorez le port de Bordeaux au XVIIIᵉ siècle, ses métiers, ses navires et ses marchandises.",
      },
      { property: "og:title", content: "Bordeaux 1750 — Le port au XVIIIᵉ siècle" },
      {
        property: "og:description",
        content:
          "Explorez en 3D le port de Bordeaux au XVIIIᵉ siècle : missions, quiz et navire marchand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});
