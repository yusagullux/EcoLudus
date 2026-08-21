import type { Metadata } from "next";
import { PublicProfileClient } from "./public-profile-client";

// Server-side metadata for the public profile, including the dynamic OG image.
// The page itself is still client-rendered because it uses the authenticated
// /api/users/[id] endpoint; the metadata is generated independently so link
// previews can resolve without running client JS.

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "EcoLudus Profile",
    openGraph: {
      title: "EcoLudus Profile",
      description: "View an Eco Explorer's sustainable journey on EcoLudus.",
      images: [`/profile/${encodeURIComponent(id)}/opengraph-image`]
    },
    twitter: {
      card: "summary_large_image",
      title: "EcoLudus Profile",
      description: "View an Eco Explorer's sustainable journey on EcoLudus.",
      images: [`/profile/${encodeURIComponent(id)}/opengraph-image`]
    }
  };
}

export default function PublicProfilePage({ params }: { params: Promise<Params> }) {
  return <PublicProfileClient params={params} />;
}
