export type NetworkPerson = {
  id: string
  name: string
  avatar: string
  headline: string
  location: string
  mutualConnections: number
  verified?: boolean
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
    verified: true,
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
  {
    id: "priya-verma",
    name: "Priya Verma",
    avatar: "/network/priya-verma.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 15,
    verified: true,
  },
  {
    id: "arjun-kapoor",
    name: "Arjun Kapoor",
    avatar: "/network/arjun-kapoor.png",
    headline: "Software Engineer at Aspira Technologies",
    location: "Bengaluru, India",
    mutualConnections: 6,
  },
  {
    id: "kavya-rao",
    name: "Kavya Rao",
    avatar: "/network/kavya-rao.png",
    headline: "Education Consultant",
    location: "Bengaluru, India",
    mutualConnections: 10,
  },
  {
    id: "meera-iyer",
    name: "Meera Iyer",
    avatar: "/network/meera-iyer.png",
    headline: "Parent at Sunshine International School",
    location: "Bengaluru, India",
    mutualConnections: 7,
  },
  {
    id: "vikram-malhotra",
    name: "Vikram Malhotra",
    avatar: "/network/vikram-malhotra.png",
    headline: "Principal at Sunshine High School",
    location: "Mumbai, India",
    mutualConnections: 9,
    verified: true,
  },
  {
    id: "ananya-desai",
    name: "Ananya Desai",
    avatar: "/network/ananya-desai.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 11,
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
  },
  {
    id: "ananya-desai",
    name: "Ananya Desai",
    avatar: "/network/ananya-desai.png",
    headline: "Parent at Delhi Public School",
    location: "New Delhi, India",
    mutualConnections: 11,
  },
]

// Stable route helpers. Every network action operates on a person's `id`, and these keep the
// profile/message URLs consistent across cards, the requests view, and the profile page — and
// easy to remap when the Parent/Student/School/Company/University dashboards merge.
export function personProfileHref(id: string) {
  return `/parent/profile?id=${encodeURIComponent(id)}`
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
    verified: true,
  },
  {
    id: "arjun-kapoor",
    name: "Arjun Kapoor",
    avatar: "/network/arjun-kapoor.png",
    headline: "Software Engineer at Aspira Technologies",
    location: "Bengaluru, India",
    mutualConnections: 6,
  },
]
