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
  return [welcome]
}

export const SPACE_FEED_POSTS: FeedPost[] = SOCIAL_SPACES.flatMap(seedPostsForSpace)

/**
 * Helper to build an event FeedPost with a consistent shape. Events live in the same feed store as
 * every other post; `scope` links a group/community event back to its space (the single source of
 * truth for membership-based visibility), and `event.source` drives the Events tab source label.
 */
function makeEvent(config: {
  id: string
  author: string
  avatar: string
  role: string
  source: EventSource
  organizer: string
  scope?: string
  title: string
  isoDate: string
  time: string
  endTime: string
  location: string
  description: string
  cover?: string
  likes?: number
  shares?: number
}): FeedPost {
  return {
    id: config.id,
    type: 'event',
    author: config.author,
    role: config.role,
    subtitle: `${config.organizer}`,
    time: 'Scheduled',
    visibility: config.source === 'private' ? 'Only me' : config.source === 'school' ? 'School' : config.source === 'group' ? 'Group' : config.source === 'community' ? 'Community' : 'Connections',
    avatar: config.avatar,
    body: '',
    hashtags: [],
    likes: config.likes ?? 0,
    shares: config.shares ?? 0,
    likedByLabel: config.likes ? `${config.likes} interested` : 'Be the first to show interest',
    comments: [],
    event: {
      title: config.title,
      date: displayDate(config.isoDate),
      isoDate: config.isoDate,
      time: config.time,
      endTime: config.endTime,
      location: config.location,
      description: config.description,
      source: config.source,
      organizer: config.organizer,
      cover: config.cover,
    },
    scope: config.scope,
  }
}

/** Formats an ISO date (YYYY-MM-DD) into a short human display like "12 Sep 2026". */
function displayDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T12:00:00`))
}

const SCHOOL = 'Greenfield Public School'

/**
 * Seed events covering every supported source. School events are always visible; group/community
 * events are scoped to a space and only surface once the parent has joined/followed it. Rashi's own
 * events are always visible. Dates are a mix of upcoming and past to exercise both sections.
 * IMPORTANT: this does NOT change Rashi's membership — that is owned entirely by the social store.
 */
export const SEED_EVENTS: FeedPost[] = [
  // --- School events (source: school, always visible, never parent-editable) ---
  makeEvent({ id: 'evt-sports-day', author: SCHOOL, avatar: '/avatar-saanvi.png', role: 'School', source: 'school', organizer: SCHOOL, title: 'Annual Sports Day', isoDate: '2026-09-12', time: '08:00 AM', endTime: '01:00 PM', location: 'Greenfield International School', description: 'Track and field events, team games, and the inter-house championship. Families are welcome to cheer on their children throughout the day.', likes: 96, shares: 14 }),
  makeEvent({ id: 'evt-ptm', author: SCHOOL, avatar: '/avatar-saanvi.png', role: 'School', source: 'school', organizer: SCHOOL, title: 'Parent-Teacher Meeting', isoDate: '2026-09-20', time: '10:00 AM', endTime: '12:30 PM', location: 'Greenfield Public School', description: 'Meet your child’s class teachers to discuss academic progress, upcoming assessments, and how to support learning at home.', likes: 58, shares: 6 }),
  makeEvent({ id: 'evt-science-expo', author: SCHOOL, avatar: '/avatar-saanvi.png', role: 'School', source: 'school', organizer: SCHOOL, title: 'Science Exhibition', isoDate: '2026-10-05', time: '11:00 AM', endTime: '03:00 PM', location: 'School Auditorium', description: 'Students present their science projects and experiments. Come explore the ideas your children have been building all term.', likes: 71, shares: 9 }),
  makeEvent({ id: 'evt-cultural-fest', author: SCHOOL, avatar: '/avatar-saanvi.png', role: 'School', source: 'school', organizer: SCHOOL, title: 'School Cultural Fest', isoDate: '2026-05-10', time: '05:00 PM', endTime: '08:00 PM', location: 'Greenfield International School', description: 'An evening of music, dance, and drama performances by students across all grades.', likes: 132, shares: 21 }),

  // --- Group events (source: group, visible only to members of that group) ---
  makeEvent({ id: 'evt-c6-picnic', author: 'Priya Sharma', avatar: '/avatar-aarav.png', role: 'Member', source: 'group', organizer: 'Class 6 Parents', scope: 'class-6-parents', title: 'Class 6 Parents Picnic', isoDate: '2026-09-15', time: '09:00 AM', endTime: '01:00 PM', location: 'Riverside City Park', description: 'A relaxed weekend picnic for Class 6 families. Bring a dish to share and get to know other parents from the class.', likes: 22, shares: 4 }),
  makeEvent({ id: 'evt-study-discussion', author: 'Shalini Rao', avatar: '/avatar-aarav.png', role: 'Member', source: 'group', organizer: 'Weekend Learning Circle', scope: 'weekend-learning-circle', title: 'Parent Study Discussion', isoDate: '2026-09-18', time: '05:00 PM', endTime: '06:30 PM', location: 'Online', description: 'A weekly discussion on effective home-study routines and sharing resources that have worked for our families.', likes: 12, shares: 2 }),

  // --- Community events (source: community, visible only to followers of that community) ---
  makeEvent({ id: 'evt-career-guidance', author: 'Aditya Rao', avatar: '/avatar-aarav.png', role: 'Community', source: 'community', organizer: 'Young Scientists', scope: 'young-scientists', title: 'Career Guidance Session', isoDate: '2026-09-22', time: '04:00 PM', endTime: '05:30 PM', location: 'Online', description: 'Industry mentors talk to students and parents about STEM career paths and how to nurture curiosity at home.', likes: 34, shares: 7 }),
  makeEvent({ id: 'evt-parenting-workshop', author: 'Leela Menon', avatar: '/avatar-aarav.png', role: 'Community', source: 'community', organizer: 'Family Wellness', scope: 'family-wellness', title: 'Parenting Workshop', isoDate: '2026-09-28', time: '03:00 PM', endTime: '04:30 PM', location: 'Community Hall, Sector 12', description: 'A hands-on workshop on positive parenting, screen-time balance, and building healthy routines for the whole family.', likes: 41, shares: 8 }),

  // --- Rashi's own events (always visible, editable/deletable by her) ---
  makeEvent({ id: 'evt-my-study-group', author: CURRENT_PARENT, avatar: '/avatar-rashi.png', role: 'Parent', source: 'connections', organizer: CURRENT_PARENT, title: 'Weekend Robotics Study Group', isoDate: '2026-09-10', time: '04:00 PM', endTime: '06:00 PM', location: 'Home · 14 Maple Residency', description: 'Inviting a few families for a small robotics practice session ahead of the next championship. Kids and parents welcome.', likes: 5, shares: 1 }),
  makeEvent({ id: 'evt-my-past-meetup', author: CURRENT_PARENT, avatar: '/avatar-rashi.png', role: 'Parent', source: 'connections', organizer: CURRENT_PARENT, title: 'Class Coffee Catch-up', isoDate: '2026-06-14', time: '10:00 AM', endTime: '11:30 AM', location: 'Bloom Cafe', description: 'A casual morning coffee with a few parents from Aarav’s class.', likes: 8, shares: 0 }),
]

/** Default RSVP seed so the "I'm Attending / Interested" section is demonstrable on a fresh device. */
export const DEFAULT_RSVP: Record<string, 'going' | 'interested'> = {
  'evt-sports-day': 'interested',
}

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
