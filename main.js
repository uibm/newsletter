function loadData(type, containerId) {
  fetch(`data/${type}.json`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById(containerId);
      const heading = document.createElement('h2');
      heading.textContent = type === 'issues' ? '🆕 New Issues' : '🚧 Pull Requests';
      container.appendChild(heading);

      data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <strong>[${item.repo}]</strong> <br>
          <a href="${item.url}" target="_blank">${item.title}</a><br>
          👤 ${item.user} | 🕒 ${new Date(item.created_at).toLocaleString()}<br>
          <p>${item.body}</p>
        `;
        container.appendChild(div);
      });
    });
}

document.addEventListener('DOMContentLoaded', () => {
  loadData('issues', 'issues');
  loadData('prs', 'prs');
});