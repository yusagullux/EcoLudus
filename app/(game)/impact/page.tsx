import { redirect } from "next/navigation";

// Impact reporting is not yet a standalone experience; consolidate it with the
// dashboard so the route does not 404 while the feature is still on the roadmap.
export default function ImpactPage() {
  redirect("/dashboard");
}
