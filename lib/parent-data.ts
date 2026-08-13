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
}

export interface FeedComment {
  id: string
  author: string
  avatar: string
  text: string
  time: string
}

export interface FeedPost {
  id: string
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
