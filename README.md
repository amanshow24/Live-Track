# LiveTrack

LiveTrack is a real-time location sharing app where users can join a room, share live updates, view active participants, and work with a compact DigiPin location code. It is built with a React + Vite frontend, a Node.js + Express + Socket.IO backend, and MongoDB for room storage.

## Live Demo
Live Link:

- https://live-track-nu.vercel.app/
Local development:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Features

- Join or create a room with a short room code
- Share live location updates in real time
- View room participants and their sharing status
- Search a location using a DigiPin code
- Click the map to generate a DigiPin for an Indian location
- View the current DigiPin only while sharing
- About page with a simple project overview
- Mobile-first UI for frequent phone use

## Tech Stack

Frontend
- React
- Vite
- MapLibre GL
- Plain CSS

Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB + Mongoose

Utilities
- DigiPin encoder and decoder helpers
- dotenv for environment configuration

## Project Structure

- `client/`
	- React app, pages, components, utilities, and styling
- `server/`
	- Express API, Socket.IO handlers, MongoDB models, and routes
- `digipin-java/`
	- Reference DigiPin implementation and supporting files

## Environment Variables

Create a `.env` file inside `server/` and add:

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/livetrack
```

Optional production values can point to your hosted MongoDB database and custom server port.

## Getting Started

1. Clone the repository

```bash
git clone <github-repo-url>
```

2. Move into the project folder

```bash
cd live-share-tracker
```

3. Install dependencies for the client and server

```bash
cd client
npm install

cd ../server
npm install
```

4. Add the server environment variables in `server/.env`

5. Start the backend

```bash
cd server
npm run dev
```

6. Start the frontend in a second terminal

```bash
cd client
npm run dev
```

## Main Routes

Client routes
- `GET /` - Join or create a room
- `GET /about` - About LiveTrack

API routes
- `GET /api/health` - Health check
- `POST /api/rooms` - Create a room
- `GET /api/rooms/:roomCode` - Fetch a room by code

Socket.IO
- Live room connection and location updates are handled through Socket.IO on the backend.

## Scripts

Client
- `npm run dev` - start the Vite development server
- `npm run build` - build the frontend for production
- `npm run preview` - preview the production build

Server
- `npm run dev` - start the server with file watching
- `npm start` - start the server normally

## Notes

- LiveTrack is designed with mobile usage in mind.
- DigiPin is an app-specific location code and is not the same as the Indian Post addressing system.
- Location sharing is room-based and real-time.

## License

ISC

## Author

Aman Show
