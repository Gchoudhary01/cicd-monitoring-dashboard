let activityChartInstance = null;
let statusChartInstance = null;

function extractRepoParts(url) {
  try {
    const cleaned = url.trim().replace(/\/+$/, "");
    const parts = cleaned.split("/");
    const owner = parts[3] || "--";
    const repo = parts[4] || "--";
    return { owner, repo, fullName: `${owner}/${repo}` };
  } catch (error) {
    return { owner: "--", repo: "--", fullName: "Invalid repo" };
  }
}

function showMessage(text, type = "error") {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.className = `message-box ${type}`;
  box.classList.remove("hidden");
}

function hideMessage() {
  const box = document.getElementById("messageBox");
  box.className = "message-box hidden";
  box.textContent = "";
}

function formatStatus(conclusion) {
  if (!conclusion) return "in_progress";
  return conclusion;
}

function statusBadge(status) {
  const normalized = (status || "").toLowerCase();

  if (normalized === "success") {
    return `<span class="status-badge status-success">SUCCESS</span>`;
  }

  if (normalized === "failure") {
    return `<span class="status-badge status-failure">FAILURE</span>`;
  }

  return `<span class="status-badge status-other">${normalized.toUpperCase()}</span>`;
}

function buildActivityData(runs) {
  const map = {};

  runs.forEach((run) => {
    const date = new Date(run.created_at);
    const label = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short"
    });
    map[label] = (map[label] || 0) + 1;
  });

  return {
    labels: Object.keys(map),
    values: Object.values(map)
  };
}

function buildStatusData(runs) {
  const counts = {
    success: 0,
    failure: 0,
    other: 0
  };

  runs.forEach((run) => {
    const status = formatStatus(run.conclusion).toLowerCase();
    if (status === "success") counts.success += 1;
    else if (status === "failure") counts.failure += 1;
    else counts.other += 1;
  });

  return counts;
}

function renderActivityChart(runs) {
  const ctx = document.getElementById("activityChart").getContext("2d");
  const activity = buildActivityData(runs);

  if (activityChartInstance) {
    activityChartInstance.destroy();
  }

  activityChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: activity.labels,
      datasets: [
        {
          label: "Workflow Runs",
          data: activity.values,
          backgroundColor: "rgba(59, 130, 246, 0.75)",
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#e7eefb"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#c9d6ec" },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#c9d6ec", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" }
        }
      }
    }
  });
}

function renderStatusChart(runs) {
  const ctx = document.getElementById("statusChart").getContext("2d");
  const statusCounts = buildStatusData(runs);

  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Success", "Failure", "Other"],
      datasets: [
        {
          data: [statusCounts.success, statusCounts.failure, statusCounts.other],
          backgroundColor: [
            "rgba(34, 197, 94, 0.85)",
            "rgba(239, 68, 68, 0.85)",
            "rgba(245, 158, 11, 0.85)"
          ],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#e7eefb"
          }
        }
      }
    }
  });
}

function renderTable(runs) {
  const tbody = document.getElementById("runs");

  if (!runs || runs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">No workflow runs found for this repository.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = runs
    .map((run) => {
      const status = formatStatus(run.conclusion);
      const branch = run.head_branch || "--";
      const event = run.event || "--";
      const time = run.created_at
        ? new Date(run.created_at).toLocaleString()
        : "--";

      return `
        <tr>
          <td>${run.name || "Unnamed Workflow"}</td>
          <td>${statusBadge(status)}</td>
          <td>${branch}</td>
          <td>${event}</td>
          <td>${time}</td>
        </tr>
      `;
    })
    .join("");
}

function renderRepoOverview(url, runs) {
  const repoParts = extractRepoParts(url);
  const latestRun = runs && runs.length > 0 ? runs[0] : null;

  document.getElementById("currentRepoName").textContent = repoParts.fullName;
  document.getElementById("repoOwner").textContent = repoParts.owner;
  document.getElementById("repoName").textContent = repoParts.repo;
  document.getElementById("latestWorkflow").textContent = latestRun?.name || "--";
  document.getElementById("latestStatus").textContent =
    formatStatus(latestRun?.conclusion || "--").toUpperCase();
  document.getElementById("lastUpdated").textContent = new Date().toLocaleTimeString();
}

function renderInsights(data, runs) {
  const insightList = document.getElementById("insightList");
  const total = Number(data.total || 0);
  const success = Number(data.success || 0);
  const failed = Number(data.failed || 0);
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;

  let trendMessage = "Pipeline activity looks limited in the currently fetched runs.";
  if (rate >= 80) trendMessage = "Build reliability looks strong based on the recent workflow history.";
  if (failed > success && total > 0) trendMessage = "Build failures are relatively high and may need investigation.";

  const latestRun = runs && runs.length > 0 ? runs[0] : null;

  insightList.innerHTML = `
    <div class="insight-item">This repository has <strong>${total}</strong> recent workflow runs available in the fetched dataset.</div>
    <div class="insight-item">The current build success rate is <strong>${rate}%</strong>, with <strong>${success}</strong> successful and <strong>${failed}</strong> failed runs.</div>
    <div class="insight-item">${trendMessage}</div>
    <div class="insight-item">Latest workflow observed: <strong>${latestRun?.name || "No workflow found"}</strong>.</div>
  `;
}

async function loadRepo() {
  const input = document.getElementById("repo");
  const button = document.getElementById("loadBtn");
  const url = input.value.trim();

  if (!url) {
    showMessage("Please enter a GitHub repository URL.");
    return;
  }

  if (!url.includes("github.com")) {
    showMessage("Please enter a valid public GitHub repository URL.");
    return;
  }

  try {
    hideMessage();
    button.disabled = true;
    button.textContent = "Loading...";

    const response = await fetch(`/api/summary?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch repository data.");
    }

    const total = Number(data.total || 0);
    const success = Number(data.success || 0);
    const failed = Number(data.failed || 0);
    const runs = Array.isArray(data.runs) ? data.runs : [];
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    document.getElementById("total").textContent = total;
    document.getElementById("success").textContent = success;
    document.getElementById("failed").textContent = failed;
    document.getElementById("successRate").textContent = `${successRate}%`;

    renderRepoOverview(url, runs);
    renderTable(runs);
    renderActivityChart(runs);
    renderStatusChart(runs);
    renderInsights(data, runs);

    showMessage("Repository data loaded successfully.", "success");
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Something went wrong while loading the repository.");
  } finally {
    button.disabled = false;
    button.textContent = "Load Repository";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  renderTable([]);
});