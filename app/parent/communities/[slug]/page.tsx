import { SocialDetail } from "@/components/parent/social-detail"

export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <SocialDetail kind="communities" slug={slug} />
}
