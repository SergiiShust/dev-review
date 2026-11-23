"use client";

import { useParams } from "next/navigation";
import { ConventionsView } from "./_components/ConventionsView";

/* Route: /repos/:repoId/conventions (Skills Lab → Conventions). Thin route entry —
   the list, cards and create-skill modal are colocated under _components/ConventionsView. */
export default function ConventionsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  return <ConventionsView repoId={repoId} />;
}
