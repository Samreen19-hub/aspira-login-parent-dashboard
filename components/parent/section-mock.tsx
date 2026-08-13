import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/parent/page-shell"

const content = {
  groups: { title: "Groups", description: "Connect with families across your school community.", icon: "Groups", items: [["Class 6 Parents", "24 members", "Discuss homework, carpools, and classroom updates."], ["Greenfield Sports", "56 members", "Coordinate fixtures, practice, and celebrations."]] },
  communities: { title: "Communities", description: "Discover school communities that match your interests.", icon: "Communities", items: [["Greenfield Public School", "School community", "Announcements, events, and conversations for every family."], ["Arts & Culture", "Open community", "Share creative opportunities and student showcases."]] },
  saved: { title: "Saved Posts", description: "Keep important updates close at hand.", icon: "Saved", items: [["Robotics showcase recap", "Saved yesterday", "Aarav's team placed second in the inter-school robotics challenge."], ["Term 2 calendar", "Saved 3 days ago", "Review upcoming events, holidays, and assessment dates."]] },
  timetable: { title: "Timetable", description: "A clear view of your children's school week.", icon: "Timetable", items: [["Monday", "8:00 AM – 3:00 PM", "Mathematics · English · Robotics"], ["Tuesday", "8:00 AM – 3:00 PM", "Science · Art · Physical Education"], ["Wednesday", "8:00 AM – 3:00 PM", "History · Mathematics · Library"]] },
  network: { title: "Parent Network", description: "Find and connect with families in your community.", icon: "Network", items: [["Priya Sharma", "Parent of Anaya · Class 6", "Interested in carpooling and weekend learning groups."], ["Kabir Mehta", "Parent of Rohan · Class 6", "Available to help coordinate the next class meetup."]] },
  messages: { title: "Messages", description: "Stay in touch with teachers and parent groups.", icon: "Messages", items: [["Ms. Anjali Verma", "Today, 10:42 AM", "Reminder: please send the robotics consent form by Friday."], ["Class 6 Parents", "Yesterday", "Thank you everyone for making the field trip so special."]] },
} as const

export function SectionMock({ kind }: { kind: keyof typeof content }) {
  const section = content[kind]
  return <PageShell title={section.title} description={section.description}><div className="grid gap-4">{section.items.map(([title, meta, detail]) => <Card key={title} className="border-border/80"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="font-display text-lg">{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{meta}</p></div><Badge variant="secondary" className="bg-brand-muted text-brand">{kind === "messages" ? "New" : "Active"}</Badge></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{detail}</p></CardContent></Card>)}</div></PageShell>
}
