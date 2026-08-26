(async function () {
  const user = await requireLogin();
  if (!user) return;
  renderAuthNav('authNav');

  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  const lockedMsg = document.getElementById('lockedMsg');
  const playerWrap = document.getElementById('playerWrap');

  if (!videoId) {
    document.getElementById('pageTitle').textContent = 'Video not found';
    lockedMsg.style.display = 'block';
    lockedMsg.querySelector('p').textContent = 'No video was specified.';
    return;
  }

  try {
    const video = await apiFetch('/api/videos/' + encodeURIComponent(videoId));
    document.getElementById('pageTitle').textContent = video.title;
    document.getElementById('videoTitle').textContent = video.title;
    document.getElementById('videoDescription').textContent = video.description;

    const videoEl = document.getElementById('video');
    videoEl.setAttribute('poster', video.poster);
    const source = document.createElement('source');
    source.src = '/media/' + encodeURIComponent(video.filename);
    source.type = 'video/mp4';
    videoEl.appendChild(source);

    playerWrap.style.display = 'block';
    initPlayerControls();
  } catch (err) {
    document.getElementById('pageTitle').textContent = 'Locked';
    lockedMsg.style.display = 'block';
    lockedMsg.querySelector('p').textContent = err.message || 'You need to unlock the course to watch this video.';
  }
})();

// Wires up the same custom player controls as the original single-video build.
function initPlayerControls() {
  const video = document.getElementById('video');
  const playBtn = document.getElementById('playBtn');
  const bigPlay = document.getElementById('bigPlay');
  const progress = document.getElementById('progress');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const muteBtn = document.getElementById('muteBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const skipBack = document.getElementById('skipBack');
  const skipForward = document.getElementById('skipForward');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');
  const toast = document.getElementById('toast');

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  function updatePlayUI() {
    const playing = !video.paused && !video.ended;
    playBtn.textContent = playing ? '❚❚' : '▶';
    bigPlay.textContent = playing ? '❚❚' : '▶';
    bigPlay.classList.toggle('hidden', playing);
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  playBtn.addEventListener('click', togglePlay);
  bigPlay.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);

  video.addEventListener('play', updatePlayUI);
  video.addEventListener('pause', updatePlayUI);
  video.addEventListener('ended', updatePlayUI);

  video.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(video.duration);
  });

  video.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(video.currentTime);
    const value = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    progress.value = value;
  });

  progress.addEventListener('input', () => {
    if (video.duration) {
      video.currentTime = (progress.value / 100) * video.duration;
    }
  });

  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
  });

  skipBack.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
  });

  skipForward.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
  });

  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.querySelector('.player').requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      showToast('Fullscreen is not available in this browser.');
    }
  });

  settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    settingsMenu.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    if (!settingsMenu.contains(event.target) && event.target !== settingsBtn) {
      settingsMenu.classList.remove('open');
    }
  });

  document.querySelectorAll('[data-speed]').forEach(button => {
    button.addEventListener('click', () => {
      video.playbackRate = Number(button.dataset.speed);
      document.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      settingsMenu.classList.remove('open');
      showToast(`Playback speed: ${button.textContent}`);
    });
  });

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
    }
    if (event.key.toLowerCase() === 'm') {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? '🔇' : '🔊';
    }
    if (event.key === 'ArrowLeft') {
      video.currentTime = Math.max(0, video.currentTime - 5);
    }
    if (event.key === 'ArrowRight') {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
    }
  });
}
