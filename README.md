<<<<<<< HEAD
# NextUp
=======
# P2 foundation: drop into client/

Copy `tailwind.config.js` to `client/` and `src/*` into `client/src/`.

Wrap your app once (main.jsx):

    import { ToastProvider } from "./components/Toast";
    <ToastProvider><App /></ToastProvider>

Install Tailwind **v3** (the latest, v4, doesn't use tailwind.config.js the same way):

    npm i -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init -p
    # then overwrite tailwind.config.js with this one, and import ./index.css in main.jsx

Optional: set VITE_API_PORT in client/.env if the server isn't on 3001.
>>>>>>> 7c2e51b (feat(counter): implement counter console integration for P2)
