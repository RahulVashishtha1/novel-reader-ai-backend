# Novel Reader AI – Backend

Hey there! This is the backend for Novel Reader AI. It's a Node.js/Express app that handles user accounts, novel uploads, annotations, sharing, and some AI-powered image generation. If you're working on this or maintaining it, here's what you need to know.

## What's Inside
- User registration, login, JWT authentication
- Upload novels (EPUB or TXT), store them in `/uploads/`
- CRUD for bookmarks, notes, and annotations
- Generate images for passages using Cloudflare or HuggingFace APIs
- Share passages or reading progress with unique links
- Track user reading stats and preferences
- Admin endpoints for managing users and novels

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file (see below)
3. Start the server:
   ```bash
   npm run dev
   ```

## Main Tech Stack
- **Node.js** + **Express**
- **Mongoose** for MongoDB
- **Multer** for file uploads
- **JWT** for authentication
- **Cloudflare/HuggingFace** for AI image generation

## Environment Variables
- `MONGODB_URI` – MongoDB connection string
- `JWT_SECRET` – Secret for JWT tokens
- `FRONTEND_URL` – Used for generating share links
- (Add any API keys for image generation as needed)

## API Structure (Main Routes)
- `/api/auth` – Register, login, get/update profile
- `/api/novels` – Upload, get, delete novels; bookmarks, notes, progress
- `/api/annotations` – Create, update, delete annotations
- `/api/images` – Generate/fetch images for passages
- `/api/sharing` – Share passages/progress, view shared content
- `/api/users` – User stats, preferences, admin actions

## How Auth & File Uploads Work
- **Auth:** Uses JWT. Tokens are sent in the `Authorization` header as `Bearer <token>`.
- **File Uploads:** Uses Multer. Uploaded novels are stored in `/uploads/novels/`.
- **Image Generation:** Uses Cloudflare Workers or HuggingFace APIs (see `utils/cloudflareAI.js`).

## Notes & To-Do
- Reading streaks aren't tracked yet (needed for frontend stats)
- Error handling could be improved in some places
- No automated tests yet – please test manually

---
If you're working on this, leave comments or notes for the next person! And update this README if you add new features or change things.

## Features
- User authentication (JWT-based)
- Upload and manage novels (EPUB, TXT)
- CRUD for bookmarks, notes, and annotations
- AI-powered image generation (Cloudflare, HuggingFace)
- Share passages and reading progress via unique URLs
- User reading statistics and preferences
- Admin endpoints for user and novel management

## Pending/Planned Features
- Reading streak tracking (not yet implemented)
- More robust error handling and validation
- Automated tests and improved documentation

## Contributing & Testing
- No automated tests yet; manual testing recommended before deployment.
- Please update this README as features are added or changed.

---
*This README was generated to reflect the current state of the backend. Update as needed!* 