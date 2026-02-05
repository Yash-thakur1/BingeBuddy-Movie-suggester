# 🎬 BingeBuddy - AI-Powered Movie Discovery

<div align="center">

![BingeBuddy Banner](https://via.placeholder.com/1200x400/0d0e10/ef5744?text=BingeBuddy+-+Discover+Your+Next+Favorite+Movie)

**A premium movie discovery platform with AI-powered recommendations, personalized learning, and a Netflix-inspired experience.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-ef5744?style=for-the-badge)](https://flixora-movie-suggester.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🌟 Features

### Core Experience
- **🎯 AI-Powered Recommendations** - Smart suggestions based on reference movies with confidence scoring
- **💬 AI Chat Assistant** - Natural language movie discovery ("Find movies like Inception")
- **😊 Mood-Based Discovery** - One-click mood buttons for instant recommendations
- **🔍 Smart Search** - Live search with auto-suggestions and filters
- **📚 Personal Watchlist** - Save movies to watch later across devices
- **🎬 Trailer Previews** - Watch trailers without leaving the page

### Personalization Engine
- **👍 Like/Dislike Learning** - Soft preference signals that improve over time
- **🧠 Attribute-Based Learning** - Learns from genres, languages, eras, and themes
- **📊 Confidence Scoring** - Shows how confident the AI is in each recommendation
- **🔄 Cross-Device Sync** - Preferences persist across sessions and devices
- **🎯 Reference-First Matching** - Cultural and thematic accuracy prioritized

### Technical Excellence
- **⚡ Edge-Optimized** - Fast page loads with Vercel Edge Network
- **📱 Fully Responsive** - Beautiful on mobile, tablet, and desktop
- **🌙 Netflix-Inspired UI** - Premium dark theme with smooth animations
- **🔒 Secure Authentication** - Firebase Auth with Google Sign-In
- **📈 Analytics Ready** - Built-in recommendation accuracy tracking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Next.js   │  │   React     │  │   Tailwind CSS          │  │
│  │   App Router│  │   18.3      │  │   + Framer Motion       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                      Backend Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Firebase   │  │  Firebase   │  │   TMDB API              │  │
│  │  Auth       │  │  Firestore  │  │   (Movie Data)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              AI Recommendation Engine                        │ │
│  │  • Reference Movie Detection  • Confidence Scoring          │ │
│  │  • Similarity Ranking         • Preference Learning         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- [TMDB API Key](https://www.themoviedb.org/settings/api) (free)
- [Firebase Project](https://console.firebase.google.com/) (for production)

### Local Development

```bash
# Clone the repository
git clone https://github.com/Yash-thakur1/Flixora_movie_suggester.git
cd Flixora_movie_suggester

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your TMDB API key

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_TMDB_API_KEY` | ✅ | TMDB API key for movie data |
| `NEXTAUTH_SECRET` | ✅ | Secret for NextAuth sessions |
| `NEXTAUTH_URL` | ✅ | Your app's URL |
| `NEXT_PUBLIC_FIREBASE_*` | 🔶 | Firebase config (for production) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 🔶 | Firebase Admin SDK (server-side) |
| `GOOGLE_CLIENT_ID` | 🔶 | Google OAuth (for Google Sign-In) |

See [.env.example](.env.example) for the complete list.

---

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy!

3. **Set up Firebase** (for user data persistence)
   - Create a Firebase project
   - Enable Authentication (Google + Email/Password)
   - Create Firestore database
   - Add Firebase config to Vercel environment variables

### Production Checklist

- [ ] Configure TMDB API key
- [ ] Set up Firebase project
- [ ] Enable Firebase Authentication
- [ ] Create Firestore database
- [ ] Configure Vercel environment variables
- [ ] Enable Firebase Analytics
- [ ] Set up custom domain (optional)
- [ ] Configure error monitoring (optional)

---

## 📊 Analytics & Monitoring

### Built-in Metrics
- Recommendations shown per user
- Like vs. dislike ratio
- Recommendation accuracy (% of liked recommendations)
- Confidence score distribution
- Search query patterns

### Firebase Analytics Events
- `recommendation_shown` - When recommendations are displayed
- `recommendation_liked` - When user likes a recommendation
- `recommendation_disliked` - When user dislikes a recommendation
- `chat_message_sent` - Chat interactions
- `movie_viewed` / `tv_show_viewed` - Content views

---

## 🔒 Security

### Data Protection
- User preferences are strictly scoped per user ID
- Guest data is isolated in session storage
- No cross-user data leakage
- HTTPS enforced on all endpoints

### Authentication
- Firebase Authentication with Google OAuth
- Email/Password with email verification
- Secure session management
- CSRF protection

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── movie/[id]/        # Movie detail page
│   └── ...
├── components/
│   ├── chat/              # AI chat components
│   ├── features/          # Feature components
│   ├── layout/            # Layout components
│   ├── movies/            # Movie components
│   ├── providers/         # Context providers
│   └── ui/                # UI primitives
├── lib/
│   ├── ai/                # AI recommendation engine
│   ├── firebase/          # Firebase services
│   ├── tmdb/              # TMDB API client
│   └── utils.ts           # Utility functions
├── store/                 # Zustand state management
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

---

## 🧪 Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS, Framer Motion |
| **State** | Zustand |
| **Auth** | Firebase Auth, NextAuth.js |
| **Database** | Firebase Firestore |
| **Movie Data** | TMDB API |
| **Hosting** | Vercel |
| **Analytics** | Firebase Analytics |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [TMDB](https://www.themoviedb.org/) for the movie database API
- [Vercel](https://vercel.com/) for hosting
- [Firebase](https://firebase.google.com/) for authentication and database
- [Next.js](https://nextjs.org/) for the amazing framework

---

<div align="center">

**Made with ❤️ by [Yash Kumar](https://github.com/Yash-thakur1)**

[⬆ Back to top](#-bingebuddy---ai-powered-movie-discovery)

</div>
