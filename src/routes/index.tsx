import { createFileRoute } from "@tanstack/react-router";
import { Brickfray } from "~/components/Brickfray";
import { seo } from "~/utils/seo";

const homePageTitle = "Brickfray — Small bricks. Big battles.";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: homePageTitle,
      description:
        "An original brick-built online FPS. Battle with up to 10 players or survive waves of Snapbots in three colorful arenas.",
      path: "/",
    }),
  component: Home,
});

function Home() {
  return <Brickfray />;
}
