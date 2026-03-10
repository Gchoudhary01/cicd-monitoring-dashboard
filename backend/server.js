const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

function extractRepo(url) {
  const cleaned = url.replace(/\/+$/, "");
  const parts = cleaned.replace("https://github.com/", "").split("/");
  return {
    owner: parts[0],
    repo: parts[1]
  };
}

app.get("/api/summary", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: "Repository URL is required." });
    }

    const { owner, repo } = extractRepo(url);

    if (!owner || !repo) {
      return res.status(400).json({ error: "Invalid GitHub repository URL." });
    }

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs`
    );

    const runs = response.data.workflow_runs || [];

    const total = runs.length;
    const success = runs.filter((r) => r.conclusion === "success").length;
    const failed = runs.filter((r) => r.conclusion === "failure").length;

    res.json({
      total,
      success,
      failed,
      runs: runs.slice(0, 10)
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to fetch pipeline data from GitHub."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});