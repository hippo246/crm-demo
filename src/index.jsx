# Open index.html and change this line:
# <script type="module" src="/src/main.jsx"></script>
# TO:
# <script type="module" src="/src/index.js"></script>

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
