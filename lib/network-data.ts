// Relationship of another real user to the currently signed-in user, derived
// server-side from the `public.connections` table. Drives the Discover card's
// primary button state (Connect / Request Sent / Respond / Connected).
export type RelationshipStatus =
  | "none"
  | "pending_outgoing"
  | "pending_incoming"
  | "connected"

export type NetworkPerson = {
  id: string
  name: string
  avatar: string
  headline: string
  location: string
  mutualConnections: number
  connectedAt?: string
  verified?: boolean
  // Populated for real database-backed people. `relationshipStatus` reflects the
  // viewer's relationship to this person; `connectionId` is the `connections`
  // row id used to accept/decline an incoming request.
  relationshipStatus?: RelationshipStatus
  connectionId?: string
}

export const NETWORK_STATS = {
  connections: 128,
  following: 85,
  followers: 64,
}

export const CONNECTIONS: NetworkPerson[] = [
  {
    id: "neha-sharma",
    name: "Neha Sharma",
    avatar: "/network/neha-sharma.png",
    headline: "Parent at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 12,
    connectedAt: "2026-08-24T09:15:00.000Z",
    verified: true,
  },
  {
    id: "rohan-mehta",
    name: "Rohan Mehta",
    avatar: "/network/rohan-mehta.png",
    headline: "Teacher at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 8,
    connectedAt: "2026-08-19T14:30:00.000Z",
    verified: true,
  },
  {
    id: "priya-verma",
    name: "Priya Verma",
    avatar: "/network/priya-verma.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 15,
    connectedAt: "2026-08-12T11:45:00.000Z",
    verified: true,
  },
  {
    id: "arjun-kapoor",
    name: "Arjun Kapoor",
    avatar: "/network/arjun-kapoor.png",
    headline: "Software Engineer at Aspira Technologies",
    location: "Bengaluru, India",
    mutualConnections: 6,
    connectedAt: "2026-08-07T08:20:00.000Z",
  },
  {
    id: "kavya-rao",
    name: "Kavya Rao",
    avatar: "/network/kavya-rao.png",
    headline: "Education Consultant",
    location: "Bengaluru, India",
    mutualConnections: 10,
    connectedAt: "2026-07-29T16:10:00.000Z",
  },
  {
    id: "meera-iyer",
    name: "Meera Iyer",
    avatar: "/network/meera-iyer.png",
    headline: "Parent at Sunshine International School",
    location: "Bengaluru, India",
    mutualConnections: 7,
    connectedAt: "2026-07-18T10:05:00.000Z",
  },
  {
    id: "vikram-malhotra",
    name: "Vikram Malhotra",
    avatar: "/network/vikram-malhotra.png",
    headline: "Principal at Sunshine High School",
    location: "Mumbai, India",
    mutualConnections: 9,
    connectedAt: "2026-07-09T13:25:00.000Z",
    verified: true,
  },
  {
    id: "ananya-desai",
    name: "Ananya Desai",
    avatar: "/network/ananya-desai.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 11,
    connectedAt: "2026-06-28T09:40:00.000Z",
  },
]

export const CONNECTION_REQUESTS: NetworkPerson[] = [
  {
    id: "kabir-mehta",
    name: "Kabir Mehta",
    avatar: "/network/kabir-mehta.png",
    headline: "Parent at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 5,
  },
  {
    id: "divya-nair",
    name: "Divya Nair",
    avatar: "/network/divya-nair.png",
    headline: "Counsellor at Sunshine High School",
    location: "Kochi, India",
    mutualConnections: 3,
  },
  {
    id: "sanjay-gupta",
    name: "Sanjay Gupta",
    avatar: "/network/sanjay-gupta.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 4,
  },
  {
    id: "dr-priya-menon",
    name: "Dr. Priya Menon",
    avatar: "/network/dr-priya-menon.png",
    headline: "Child Psychologist",
    location: "Chennai, India",
    mutualConnections: 2,
    verified: true,
  },
]

export const FOLLOWING: NetworkPerson[] = [
  {
    id: "vikram-malhotra",
    name: "Vikram Malhotra",
    avatar: "/network/vikram-malhotra.png",
    headline: "Principal at Sunshine High School",
    location: "Mumbai, India",
    mutualConnections: 9,
    connectedAt: "2026-07-09T13:25:00.000Z",
    verified: true,
  },
  {
    id: "dr-priya-menon",
    name: "Dr. Priya Menon",
    avatar: "/network/dr-priya-menon.png",
    headline: "Child Psychologist",
    location: "Chennai, India",
    mutualConnections: 2,
    verified: true,
  },
  {
    id: "kavya-rao",
    name: "Kavya Rao",
    avatar: "/network/kavya-rao.png",
    headline: "Education Consultant",
    location: "Bengaluru, India",
    mutualConnections: 10,
    connectedAt: "2026-07-29T16:10:00.000Z",
  },
  {
    id: "rohan-mehta",
    name: "Rohan Mehta",
    avatar: "/network/rohan-mehta.png",
    headline: "Teacher at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 8,
    verified: true,
  },
]

export const FOLLOWERS: NetworkPerson[] = [
  {
    id: "neha-sharma",
    name: "Neha Sharma",
    avatar: "/network/neha-sharma.png",
    headline: "Parent at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 12,
    verified: true,
  },
  {
    id: "sanjay-gupta",
    name: "Sanjay Gupta",
    avatar: "/network/sanjay-gupta.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 4,
  },
  {
    id: "meera-iyer",
    name: "Meera Iyer",
    avatar: "/network/meera-iyer.png",
    headline: "Parent at Sunshine International School",
    location: "Bengaluru, India",
    mutualConnections: 7,
    connectedAt: "2026-07-18T10:05:00.000Z",
  },
  {
    id: "ananya-desai",
    name: "Ananya Desai",
    avatar: "/network/ananya-desai.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 11,
    connectedAt: "2026-06-28T09:40:00.000Z",
  },
]

// Stable route helpers. Every network action operates on a person's `id`, and these keep the
// profile/message URLs consistent across cards, the requests view, and the profile page — and
// easy to remap when the Parent/Student/School/Company/University dashboards merge.
export function personProfileHref(id: string, returnTo?: string) {
  const params = new URLSearchParams({ id })

  if (returnTo === "/parent" || returnTo?.startsWith("/parent/")) {
    params.set("returnTo", returnTo)
  }

  return `/parent/profile?${params.toString()}`
}

export function personMessageHref(id: string) {
  return `/parent/messages?to=${encodeURIComponent(id)}`
}

// Single lookup across every relationship list so any surface can resolve a person by id without
// duplicating the sample data. Ids are shared across lists (a person can be both a follower and a
// connection), so the first match wins.
export function getNetworkPerson(id: string): NetworkPerson | undefined {
  return [...CONNECTIONS, ...CONNECTION_REQUESTS, ...FOLLOWING, ...FOLLOWERS, ...DISCOVER].find(
    (person) => person.id === id,
  )
}

export const DISCOVER: NetworkPerson[] = [
  {
    id: "kabir-mehta",
    name: "Kabir Mehta",
    avatar: "/network/kabir-mehta.png",
    headline: "Parent at Greenfield International School",
    location: "Bengaluru, India",
    mutualConnections: 5,
  },
  {
    id: "divya-nair",
    name: "Divya Nair",
    avatar: "/network/divya-nair.png",
    headline: "Counsellor at Sunshine High School",
    location: "Kochi, India",
    mutualConnections: 3,
  },
  {
    id: "priya-verma",
    name: "Priya Verma",
    avatar: "/network/priya-verma.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 15,
    connectedAt: "2026-08-12T11:45:00.000Z",
    verified: true,
  },
  {
    id: "arjun-kapoor",
    name: "Arjun Kapoor",
    avatar: "/network/arjun-kapoor.png",
    headline: "Software Engineer at Aspira Technologies",
    location: "Bengaluru, India",
    mutualConnections: 6,
    connectedAt: "2026-08-07T08:20:00.000Z",
  },
]
