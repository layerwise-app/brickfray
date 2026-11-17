import { createFileRoute, notFound } from "@tanstack/react-router";
import { Brickfray } from "~/components/Brickfray";
import { seo } from "~/utils/seo";
import type { MapId } from "~/brickfray/config";
export const Route = createFileRoute("/lab/$map")({
  beforeLoad: ({ params }) => {
    if (
      !import.meta.env.DEV ||
      !["plaza", "fortress", "docks"].includes(params.map)
    )
      throw notFound();
  },
  head: () => seo({ title: "Brickfray — Developer range", noindex: true }),
  component: Lab,
});
function Lab() {
  const { map } = Route.useParams();
  return <Brickfray labMap={map as MapId} />;
}
