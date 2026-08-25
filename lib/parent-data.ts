/**
 * Sample parent data for the prototype. Kept in one place so the same shape can
 * later be swapped for real backend data without touching the UI components.
 */

export interface Child {
  id: string
  name: string
  className: string
  school: string
  avatar: string
  progress: number
  online?: boolean
  /** Optional date of birth (YYYY-MM-DD), captured in the add/edit child flow. */
  dob?: string
  /** Optional relationship to the parent, e.g. "Child", "Guardian". */
  relationship?: string
}

export interface FeedComment {
  id: string
  author: string
  avatar: string
  text: string
  time: string
  image?: string
}

export type FeedPostType = 'text' | 'photo' | 'achievement' | 'poll' | 'event'

/**
 * Where an event originates / who can see it. Drives the Events tab source label and, together
 * with the live membership state (joined groups / followed communities), its visibility.
 * - school: created by the school/admin, always visible to parents (never parent-editable)
 * - group / community: belongs to a space (post.scope = slug); visible only to members/followers
 * - connections: a parent-created event shared with their connections
 * - private: a parent-created event visible only to the creator ("Only Me")
 */
export type EventSource = 'school' | 'group' | 'community' | 'connections' | 'private'

export interface EventDetails {
  title: string
  /** Human display date, e.g. "12 Sep 2026". */
  date: string
  /** Start time display, e.g. "08:00 AM". */
  time: string
  location: string
  description: string
  /** Machine date (YYYY-MM-DD) used for sorting and upcoming/past classification. */
  isoDate?: string
  /** End time display, e.g. "10:00 AM". */
  endTime?: string
  source?: EventSource
  /** Who is hosting, e.g. a school name, a space name, or the parent's name. */
  organizer?: string
  /** Optional cover image URL. */
  cover?: string
}

export interface FeedPost {
  id: string
  type: FeedPostType
  author: string
  role: string
  subtitle: string
  time: string
  visibility: string
  avatar: string
  body: string
  hashtags: string[]
  image?: string
  likes: number
  comments: FeedComment[]
  shares: number
  likedByLabel: string
  achievement?: { title: string; child: string; description: string }
  poll?: { question: string; options: string[]; votes: number[]; voted?: number }
  event?: EventDetails
  /** When set, this post belongs to a specific group/community feed (by slug) and is kept out of the Home Feed. */
  scope?: string
}

export interface SocialSpace {
  slug: string
  kind: 'groups' | 'communities'
  title: string
  description: string
  category: string
  members: number
  tone: string
  initials: string
  privacy: 'Public' | 'Private'
  memberNames: string[]
}

export interface InviteContact {
  id: string
  name: string
  detail: string
  avatar: string
}

export interface EventItem {
  id: string
  title: string
  date: string
  time: string
  tone: 'rose' | 'blue' | 'green'
  school?: string
  location?: string
  type?: string
  description?: string
}

export interface NotificationItem {
  id: string
  title: string
  time: string
  unread?: boolean
  description?: string
  category?: string
}

export const PARENT_PROFILE = {
  name: 'Rashi Kapoor',
  role: 'Parent',
  avatar: '/avatar-rashi.png',
  profileCompletion: 85,
  childOf: 'Parent of Aarav Kapoor',
}

export const CHILDREN: Child[] = [
  {
    id: 'aarav',
    name: 'Aarav Kapoor',
    className: 'Class 6',
    school: 'Greenfield Public School',
    avatar: '/avatar-aarav.png',
    progress: 92,
    online: true,
  },
  {
    id: 'saanvi',
    name: 'Saanvi Kapoor',
    className: 'Class 3',
    school: 'Greenfield Public School',
    avatar: '/avatar-saanvi.png',
    progress: 88,
    online: true,
  },
]

export const FEED_POSTS: FeedPost[] = [
  {
    id: 'post-robotics',
    type: 'photo',
    author: 'Rashi Kapoor',
    role: 'Parent',
    subtitle: 'Parent of Aarav Kapoor  ·  Class 6, Greenfield Public School',
    time: 'Just now',
    visibility: 'Public',
    avatar: '/avatar-rashi.png',
    body: 'Proud moment! 🏆🎉\nAarav won Gold Medal in the State Level Robotics Championship 2025!\nGrateful to his teachers, school and everyone who supported him in this journey.',
    hashtags: ['#ProudParent', '#RoboticsChampion', '#StateLevel', '#AspiraMoments'],
    image: '/post-robotics.png',
    likes: 142,
    shares: 23,
    likedByLabel: 'Neha Sharma, Amit Verma and 140 others',
    comments: [
      {
        id: 'c1',
        author: 'Neha Sharma',
        avatar: '/avatar-saanvi.png',
        text: 'Many congratulations to Aarav! So well deserved. 👏',
        time: '2m',
      },
      {
        id: 'c2',
        author: 'Amit Verma',
        avatar: '/avatar-aarav.png',
        text: 'Fantastic achievement. The whole class is proud of him!',
        time: '5m',
      },
    ],
  },
  {
    id: 'post-annual-day',
    type: 'text',
    author: 'Greenfield Public School',
    role: 'School',
    subtitle: 'Official School Page  ·  Greenfield Public School',
    time: '3h ago',
    visibility: 'Public',
    avatar: '/avatar-saanvi.png',
    body: 'Registrations are now open for the Annual Day Celebration 2025. Parents are requested to confirm attendance through the Events tab. We look forward to celebrating our students together!',
    hashtags: ['#AnnualDay', '#Greenfield', '#Celebration'],
    likes: 64,
    shares: 12,
    likedByLabel: 'Rashi Kapoor and 63 others',
    comments: [
      {
        id: 'c3',
        author: 'Rashi Kapoor',
        avatar: '/avatar-rashi.png',
        text: 'Looking forward to it! Saanvi is very excited. 😊',
        time: '1h',
      },
    ],
  },
]

export const UPCOMING_EVENTS: EventItem[] = [
  {
    id: 'e1',
    title: 'Parent Teacher Meeting',
    date: '24 May 2025',
    time: '10:00 AM',
    tone: 'rose',
  },
  {
    id: 'e2',
    title: 'Annual Day Celebration',
    date: '31 May 2025',
    time: '04:00 PM',
    tone: 'blue',
  },
  {
    id: 'e3',
    title: 'Science Exhibition',
    date: '7 June 2025',
    time: '11:00 AM',
    tone: 'green',
  },
]

export const SCHOOL_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', title: 'New Circular: Summer Break Notice', time: '2h ago', unread: true },
  { id: 'n2', title: 'Homework Due: Maths Worksheet', time: '5h ago', unread: true },
  { id: 'n3', title: 'Exam Schedule Published', time: '1d ago' },
]

/**
 * Groups and communities share a single shape so the listing pages and the
 * detail/feed page read from one source of truth.
 */
export const SOCIAL_SPACES: SocialSpace[] = [
  {
    slug: 'class-6-parents',
    kind: 'groups',
    title: 'Class 6 Parents',
    description: 'Discuss homework, carpools, and classroom updates.',
    category: 'School',
    members: 24,
    tone: 'bg-violet-100 text-violet-700',
    initials: 'C6',
    privacy: 'Private',
    memberNames: ['Rashi Kapoor', 'Priya Sharma', 'Kabir Mehta', 'Neha Sharma', 'Amit Verma', 'Divya Rao'],
  },
  {
    slug: 'greenfield-sports',
    kind: 'groups',
    title: 'Greenfield Sports',
    description: 'Coordinate fixtures, practice, and celebrations.',
    category: 'Activities',
    members: 56,
    tone: 'bg-blue-100 text-blue-700',
    initials: 'GS',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Arjun Nair', 'Meera Iyer', 'Sanjay Gupta', 'Farah Khan'],
  },
  {
    slug: 'robotics-parents',
    kind: 'groups',
    title: 'Robotics Parents',
    description: 'Share competition news, build sessions, and useful resources.',
    category: 'Activities',
    members: 18,
    tone: 'bg-amber-100 text-amber-700',
    initials: 'RP',
    privacy: 'Private',
    memberNames: ['Rashi Kapoor', 'Vikram Desai', 'Anita Menon', 'Rohan Bose'],
  },
  {
    slug: 'weekend-learning-circle',
    kind: 'groups',
    title: 'Weekend Learning Circle',
    description: 'A friendly space for family learning plans and recommendations.',
    category: 'Learning',
    members: 31,
    tone: 'bg-emerald-100 text-emerald-700',
    initials: 'WL',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Shalini Rao', 'Imran Sheikh', 'Deepa Nair'],
  },
  {
    slug: 'greenfield-public-school',
    kind: 'communities',
    title: 'Greenfield Public School',
    description: 'Announcements, events, and conversations for every family.',
    category: 'Schools',
    members: 248,
    tone: 'bg-violet-100 text-violet-700',
    initials: 'GP',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Greenfield Public School', 'Priya Sharma', 'Kabir Mehta', 'Neha Sharma'],
  },
  {
    slug: 'arts-culture',
    kind: 'communities',
    title: 'Arts & Culture',
    description: 'Share creative opportunities and student showcases.',
    category: 'Interests',
    members: 86,
    tone: 'bg-pink-100 text-pink-700',
    initials: 'AC',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Maya Pillai', 'Rohit Sen', 'Aisha Qureshi'],
  },
  {
    slug: 'young-scientists',
    kind: 'communities',
    title: 'Young Scientists',
    description: 'Explore experiments, exhibitions, and science fair ideas.',
    category: 'Interests',
    members: 74,
    tone: 'bg-cyan-100 text-cyan-700',
    initials: 'YS',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Nikhil Jain', 'Sara Thomas', 'Aditya Rao'],
  },
  {
    slug: 'family-wellness',
    kind: 'communities',
    title: 'Family Wellness',
    description: 'Practical conversations about routines, balance, and wellbeing.',
    category: 'Wellness',
    members: 112,
    tone: 'bg-emerald-100 text-emerald-700',
    initials: 'FW',
    privacy: 'Public',
    memberNames: ['Rashi Kapoor', 'Leela Menon', 'Gaurav Malhotra', 'Tanvi Shah'],
  },
]

export function getSocialSpace(slug: string) {
  return SOCIAL_SPACES.find((space) => space.slug === slug)
}

/** The signed-in demo parent. Membership is tracked live in the social store, never hardcoded per space. */
export const CURRENT_PARENT = 'Rashi Kapoor'

/**
 * Members of a space excluding the current parent. The current parent is only ever shown as a
 * member when they have actually joined/followed, so membership has a single source of truth.
 */
export function otherMemberNames(space: SocialSpace) {
  return space.memberNames.filter((name) => name !== CURRENT_PARENT)
}

/** Realistic sample posts seeded into each group/community feed so it never looks empty. */
function seedPostsForSpace(space: SocialSpace): FeedPost[] {
  const isGroup = space.kind === 'groups'
  const memberAuthor = space.memberNames[1] ?? 'Priya Sharma'
  const welcome: FeedPost = {
    id: `${space.slug}-seed-welcome`,
    type: 'text',
    author: memberAuthor,
    role: isGroup ? 'Member' : 'Community',
    subtitle: `Member · ${space.title}`,
    time: '2h ago',
    visibility: isGroup ? 'Group' : 'Community',
    avatar: '/avatar-saanvi.png',
    body: isGroup
      ? `Welcome to ${space.title}! This is our space to share updates, ask questions, and support each other. Feel free to introduce yourself.`
      : `So glad to see ${space.title} growing. Share your ideas, opportunities, and moments here so every family can join in.`,
    hashtags: [],
    likes: 18,
    shares: 3,
    likedByLabel: 'Rashi Kapoor and 17 others',
    comments: [
      { id: `${space.slug}-seed-c1`, author: 'Rashi Kapoor', avatar: '/avatar-rashi.png', text: 'Happy to be here!', time: '1h' },
    ],
    scope: space.slug,
  }
  const event: FeedPost = {
    id: `${space.slug}-seed-event`,
    type: 'event',
    author: space.memberNames[0] === 'Rashi Kapoor' ? memberAuthor : space.memberNames[0],
    role: isGroup ? 'Member' : 'Community',
    subtitle: `Organiser · ${space.title}`,
    time: '1d ago',
    visibility: isGroup ? 'Group' : 'Community',
    avatar: '/avatar-aarav.png',
    body: '',
    hashtags: [],
    likes: 26,
    shares: 6,
    likedByLabel: 'Neha Sharma and 25 others',
    comments: [],
    event: {
      title: isGroup ? `${space.title} Meetup` : `${space.title} Open House`,
      date: '14 Jun 2025',
      time: '05:00 PM',
      location: 'Greenfield Public School, Auditorium',
      description: `Join fellow families from ${space.title} for a relaxed get-together. Snacks, introductions, and plenty of conversation.`,
    },
    scope: space.slug,
  }
  return [welcome, event]
}

export const SPACE_FEED_POSTS: FeedPost[] = SOCIAL_SPACES.flatMap(seedPostsForSpace)

/** Contact pool used by the "Invite members" flow. */
export const INVITE_CONTACTS: InviteContact[] = [
  { id: 'inv-priya', name: 'Priya Sharma', detail: 'Parent of Anaya · Class 6', avatar: '/avatar-saanvi.png' },
  { id: 'inv-kabir', name: 'Kabir Mehta', detail: 'Parent of Rohan · Class 6', avatar: '/avatar-aarav.png' },
  { id: 'inv-neha', name: 'Neha Sharma', detail: 'Parent of Ira · Class 5', avatar: '/avatar-saanvi.png' },
  { id: 'inv-amit', name: 'Amit Verma', detail: 'Parent of Vivaan · Class 6', avatar: '/avatar-aarav.png' },
  { id: 'inv-divya', name: 'Divya Rao', detail: 'Parent of Meher · Class 4', avatar: '/avatar-saanvi.png' },
  { id: 'inv-arjun', name: 'Arjun Nair', detail: 'Parent of Kiaan · Class 6', avatar: '/avatar-aarav.png' },
  { id: 'inv-meera', name: 'Meera Iyer', detail: 'Parent of Advait · Class 3', avatar: '/avatar-saanvi.png' },
  { id: 'inv-sanjay', name: 'Sanjay Gupta', detail: 'Parent of Reyansh · Class 6', avatar: '/avatar-aarav.png' },
]
