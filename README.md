# Study Rival

A shared two-person focus timer built without external packages.

## Put it online (best for people in different places)

1. Create a GitHub account and a new empty repository.
2. Upload every file in this folder to the repository.
3. Create a free [Render](https://render.com/) account, then choose **New > Web Service** and connect that GitHub repository.
4. Choose **Node**, leave the build command empty, and set the start command to `npm start`.
5. Choose the **Free** instance and create the service. Render gives you a public `onrender.com` link to share.

The free service may need about a minute to wake up after 15 minutes without visitors. Its current session resets if the service restarts or sleeps.

## Run it on your own computer

Install a current version of [Node.js](https://nodejs.org/), then open a terminal in this folder and run:

```powershell
node app.js
```

Open `http://localhost:3000/?room=your-session-name`. Both people must use the identical URL. To use two devices, host the folder on any Node-compatible service, or share the address from a machine reachable on your network.

## Built in

- One shared timer and task board per room link
- Teams lock as soon as a person joins, so they cannot switch sides mid-session
- Either rival can set the shared session length before the first start
- An arcade-style 3, 2, 1, FIGHT countdown begins the session
- Both people can pause, which pauses the session for everyone
- Pausing requires an honesty log and gives the pauser 5 penalty points
- Only the person who paused can resume
- Tasks, penalties, pause log, and timer all update for both browsers
- Either rival can paste a Spotify playlist/track/Jam link that's shared and shown for both browsers
- A welcome dialog with the focus rules pops up the first time a browser opens a room
- Arcade-style sound effects for joining, setting the timer, tasks, pausing, and resetting (toggle with the Sound button)
- The pause log can be copied at the end

Session data is stored in the running server's memory, so restarting the server starts a fresh session.
