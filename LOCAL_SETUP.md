# Run BookMyAppointment locally

This guide sets up the API, web app, MongoDB, local Ollama models, and private report uploads on a development machine.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB running locally, or a MongoDB Atlas connection string. MongoDB is required for persistent accounts, hospitals, appointments, and report metadata.
- Ollama for semantic symptom search. The app can use its keyword fallback without Ollama, but RAG symptom search needs the chat and embedding models below.
- Git, if you are cloning this project.

## 1. Install dependencies

From the project root:

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
```

## 2. Create local environment files

From the project root, copy the examples once:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set:

- `MONGODB_URI` to your running local MongoDB database or Atlas URI.
- `JWT_SECRET` to a long, private random value.
- `ADMIN_SIGNUP_KEY` to a private key you will enter once when creating the first global admin.
- Keep `PORT=5000` and `CLIENT_URL=http://localhost:5173` for the defaults below. If you change ports, update `client/.env` so `VITE_API_URL` points to the matching API URL.

The example uses a local MongoDB URI: `mongodb://localhost:27017/bookmyappointment`. For Atlas, paste the full connection string into `MONGODB_URI` and ensure your database user and network access rules allow your machine to connect.

Keep both `.env` files private. They are ignored by Git; commit the `.env.example` files only. Never put real MongoDB credentials or private keys in a checked-in file.

## 3. Start MongoDB

Start your local MongoDB service using the method for your operating system, or use the Atlas URI configured above. The API may start without MongoDB, but persistent accounts, report uploads, provider listings, and appointments will not work until the database connects.

## 4. Set up Ollama models

Install and start Ollama, then run these commands in a terminal:

```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text:latest
ollama list
```

The server example is configured for Ollama at `http://127.0.0.1:11434` with those model names. The symptom vector file, `symptom-knowledge-embedded.csv`, is already included. Rebuild it only after editing `symptom-knowledge.csv`:

```bash
npm run embed:symptoms --prefix server
```

No cloud LLM key is required. `glm-5.3-flash:cloud` is not needed for this local setup.

## 5. Start the application

From the project root:

```bash
npm run dev
```

This starts the API and web app together. Open:

- Web app: <http://localhost:5173>
- API health: <http://localhost:5000/api/health>

The health response should show `"mode":"mongodb"`. If it says `memory`, check the API terminal and fix the MongoDB connection before using the app.

You can also run each process in its own terminal:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

## 6. Create accounts and provider records

1. Open <http://localhost:5173/login>.
2. Choose **Set up first global admin** and enter the same `ADMIN_SIGNUP_KEY` configured in `server/.env`.
3. Sign in as that admin and add a hospital. Enter its real city name; the city becomes available to patients automatically.
4. Add doctors under the hospital. Each doctor gets a login email and temporary password.
5. Register patient accounts through the normal sign-up form, then book appointments and use the appointment conversation to exchange messages and report files.

Startup does not seed demo hospitals or doctors. The initial directory will be empty until the admin adds real records.

## Report files and Git

Uploaded reports are stored as original files in `server/uploads/`; MongoDB stores their metadata and sharing permissions. The upload folder is ignored by Git, apart from its `.gitkeep` marker. Do not commit patient reports, local environment files, credentials, or `node_modules`.

The root `.gitignore` excludes local environment files while allowing `.env.example` files. It also excludes dependencies, build output, logs, and uploaded patient files. Ignore rules do not remove files already tracked by Git; check `git status` before committing. If a credential or private report was committed earlier, remove it from repository history and rotate the credential.

## Useful commands

```bash
npm run dev                              # Start API and web app
npm run dev --prefix server             # Start API only
npm run dev --prefix client             # Start web app only
npm run build --prefix client           # Build the web app
npm run embed:symptoms --prefix server  # Regenerate the symptom embedding CSV
ollama list                             # Check locally available Ollama models
```
