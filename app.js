const express = require('express');
const app = express();
const port = 8080; // App listens on this port inside the container

const APP_VERSION = process.env.APP_VERSION || "v1.0 (Blue)"; // Default version/color
const POD_NAME = process.env.POD_NAME || "Unknown Pod";
const DEPLOY_COLOR = process.env.DEPLOY_COLOR || "Unknown"; // Added Color env var

app.get('/', (req, res) => {
  console.log(`Received request on ${POD_NAME} (Color: ${DEPLOY_COLOR})`);
  // Simple HTML with background color based on deployment
  res.send(`
    <html>
      <head><title>Blue/Green</title></head>
      <body style="background-color: ${DEPLOY_COLOR === 'blue' ? 'lightblue' : 'lightgreen'}; padding: 20px;">
        <h1>Hello from ${APP_VERSION} (Color: ${DEPLOY_COLOR})</h1>
        <h2>Running on pod: ${POD_NAME}</h2>
        <p>Timestamp: ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Sample app listening at http://localhost:${port}`);
  console.log(`Version: ${APP_VERSION}, Color: ${DEPLOY_COLOR}`);
});