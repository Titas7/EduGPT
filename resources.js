// resources.js (frontend)
document.addEventListener("DOMContentLoaded", loadResources);

function loadResources() {
    const data = JSON.parse(localStorage.getItem("aiResources") || "null");
    const list = document.getElementById("resourceList");
    const goalTitle = document.getElementById("goalTitle");

    if (!data || !data.resources) {
        list.innerHTML = `<p class="error">⚠️ No resources found. Generate a plan first.</p>`;
        return;
    }

    document.title = `Resources | ${data.goal}`;
    goalTitle.innerHTML = `📌 Topic: <strong>${data.goal}</strong>`;

    // Put verified videos first
    const verified = data.resources.filter(r => r.verified);
    const unverified = data.resources.filter(r => !r.verified);

    if (verified.length === 0) {
        list.innerHTML = `<p>No verified resources were returned for <strong>${data.goal}</strong>. Try again or check network / AI quota.</p>`;
        return;
    }

    // Videos first (YouTube)
    const videos = verified.filter(r => r.type.toLowerCase().includes("youtube"));
    const articles = verified.filter(r => !r.type.toLowerCase().includes("youtube"));

    let html = "";
    if (videos.length > 0) {
        html += `<h3>🎥 Verified YouTube Videos</h3><div class="grid">`;
        videos.forEach(v => {
            const idMatch = v.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
            const vid = idMatch ? idMatch[1] : null;
            const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : '';
            html += `
                <div class="card video">
                    ${thumb ? `<img class="thumb" src="${thumb}" onclick="openUrl('${v.url}')" />` : ''}
                    <h4>${v.title}</h4>
                    <div><button onclick="openUrl('${v.url}')">▶ Watch</button></div>
                </div>
            `;
        });
        html += "</div>";
    }

    if (articles.length > 0) {
        html += `<h3>🌐 Articles & Guides</h3><div class="grid">`;
        articles.forEach(a => {
            html += `
                <div class="card article">
                    <h4>${a.title}</h4>
                    <div><button onclick="openUrl('${a.url}')">🌐 Open</button></div>
                </div>
            `;
        });
        html += "</div>";
    }

    // If there were unverified items, show a small note (optional)
    if (unverified.length > 0) {
        html += `<div style="margin-top:16px;color:#666;font-size:0.95rem;">
                    ⚠️ ${unverified.length} resource(s) were found but could not be verified and were omitted.
                 </div>`;
    }

    list.innerHTML = html;
}

function openUrl(url) {
    window.open(url, "_blank");
}
