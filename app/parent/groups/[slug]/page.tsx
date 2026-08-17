import { SocialDetail } from "@/components/parent/social-detail"

export default async function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <SocialDetail kind="groups" slug={slug} />
}
