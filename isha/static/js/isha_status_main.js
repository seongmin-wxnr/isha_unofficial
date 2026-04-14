document.addEventListener("DOMContentLoaded", () => {
  const revealItems = document.querySelectorAll(".reveal");

  const latestNewsGrid = document.getElementById("latestNewsGrid");
  const upcomingScheduleTimeline = document.getElementById("upcomingScheduleTimeline");

  const heroPinnedTitle = document.getElementById("heroPinnedTitle");
  const heroPinnedSummary = document.getElementById("heroPinnedSummary");
  const heroNextScheduleTitle = document.getElementById("heroNextScheduleTitle");
  const heroNextScheduleSummary = document.getElementById("heroNextScheduleSummary");

  const liveStatusBadge = document.getElementById("liveStatusBadge");
  const liveStatusTitle = document.getElementById("liveStatusTitle");
  const liveStatusDesc = document.getElementById("liveStatusDesc");

  const youtubeLiveTitle = document.getElementById("youtubeLiveTitle");
  const youtubeLiveDesc = document.getElementById("youtubeLiveDesc");
  const youtubeLiveLink = document.getElementById("youtubeLiveLink");
  const youtubeLatestTitle = document.getElementById("youtubeLatestTitle");
  const youtubeLatestDesc = document.getElementById("youtubeLatestDesc");
  const youtubeLatestLink = document.getElementById("youtubeLatestLink");
  const youtubeVideoGrid = document.getElementById("youtubeVideoGrid");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -40px 0px" }
  );
  revealItems.forEach((item) => observer.observe(item));

  let youtubeAllVideos = [];
  let youtubeFiltered = [];
  const VIDEOS_PER_PAGE = 6;
  let currentPage = 1;
  let currentTab = "all";

  const TYPE_LABEL = {
    video: "일반 영상",
    short: "쇼츠",
    music: "노래",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNoticeType(category) {
    const map = { notice: "NOTICE", important: "IMPORTANT", update: "UPDATE", schedule: "SCHEDULE", archive: "ARCHIVE" };
    return map[category] || "NOTICE";
  }

  function formatDateLabel(dateText) {
    if (!dateText) return "";
    return String(dateText).replace(/-/g, ".");
  }

  function formatDateTimeLabel(isoText) {
    if (!isoText) return "";
    const d = new Date(isoText);
    if (Number.isNaN(d.getTime())) return isoText;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  }

  function formatDuration(seconds) {
    const value = Number(seconds || 0);
    if (!value) return "길이 정보 없음";
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function renderLatestNews(items) {
    if (!latestNewsGrid) return;
    if (!items.length) {
      latestNewsGrid.innerHTML = `
        <article class="update-card large">
          <span class="update-type">EMPTY</span>
          <h3>등록된 공지가 없습니다</h3>
          <p>아직 표시할 최신 공지가 없습니다.</p>
          <a href="/news/" class="card-link">공지사항 페이지 이동</a>
        </article>`;
      return;
    }
    latestNewsGrid.innerHTML = items.map((item, index) => {
      const largeClass = index === 0 ? "large" : "";
      const summary = item.summary || item.preview || "공지사항 페이지에서 자세한 내용을 확인해보세요.";
      return `
        <article class="update-card ${largeClass}">
          <span class="update-type">${escapeHtml(formatNoticeType(item.category))}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(summary)}</p>
          <a href="/news/" class="card-link">${escapeHtml(item.date)} · 자세히 보기</a>
        </article>`;
    }).join("");
  }

  function renderUpcomingSchedules(items) {
    if (!upcomingScheduleTimeline) return;
    if (!items.length) {
      upcomingScheduleTimeline.innerHTML = `
        <article class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span class="timeline-date">EMPTY</span>
            <h3>예정된 일정이 없습니다</h3>
            <p>현재 등록된 예정 일정이 없습니다.</p>
          </div>
        </article>`;
      return;
    }
    upcomingScheduleTimeline.innerHTML = items.map((item) => {
      const timeText = item.end_time ? `${item.start_time} - ${item.end_time}` : item.start_time || "시간 미정";
      const subtitle = item.subtitle || "추가 설명이 없습니다.";
      return `
        <article class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span class="timeline-date">${escapeHtml(formatDateLabel(item.date))} · ${escapeHtml(timeText)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </article>`;
    }).join("");
  }

  function renderHeroPreview(newsItems, scheduleItems) {
    const pinned = (newsItems || []).find((item) => item.pinned) || (newsItems || [])[0];
    const nextSchedule = (scheduleItems || [])[0];

    if (heroPinnedTitle) heroPinnedTitle.textContent = pinned ? pinned.title : "대표 공지가 없습니다.";
    if (heroPinnedSummary) heroPinnedSummary.textContent = pinned
      ? (pinned.summary || pinned.preview || "공지사항 페이지에서 자세한 내용을 확인해보세요.")
      : "아직 등록된 공지가 없습니다.";
    if (heroNextScheduleTitle) heroNextScheduleTitle.textContent = nextSchedule ? nextSchedule.title : "예정된 일정이 없습니다.";
    if (heroNextScheduleSummary) {
      if (nextSchedule) {
        const timeText = nextSchedule.end_time
          ? `${nextSchedule.start_time} - ${nextSchedule.end_time}`
          : nextSchedule.start_time || "시간 미정";
        heroNextScheduleSummary.textContent = `${formatDateLabel(nextSchedule.date)} · ${timeText} · ${nextSchedule.subtitle || "추가 설명 없음"}`;
      } else {
        heroNextScheduleSummary.textContent = "현재 등록된 예정 일정이 없습니다.";
      }
    }
  }

  function renderChzzkLiveStatus(data) {
    const isLive = Boolean(data?.isLive);
    const live = data?.live || {};

    const channelId = live.channelId || data.channelId || "d9c00ea08106b660e26abcd730e7d796";
    const chzzkChannelUrl = `https://chzzk.naver.com/${channelId}`;
    const chzzkLiveUrl = `https://chzzk.naver.com/live/${channelId}`;

    const liveTitle = live.liveTitle || "";
    const viewerCount = live.concurrentUserCount ?? live.accumulateCount ?? 0;
    const categoryName = live.liveCategoryValue || live.liveCategory || "";
    const liveImageUrl = (live.liveThumbnailImageUrl || live.liveImageUrl || "").replace("{type}", "480");

    const card = document.getElementById("liveStatusCard");
    if (card) {
      if (isLive) {
        card.style.cursor = "pointer";
        card.onclick = null;
        card.innerHTML = `
          <a href="${escapeHtml(chzzkLiveUrl)}" target="_blank" rel="noopener noreferrer" class="live-card-link">
            <div class="live-card-thumb-wrap">
              ${liveImageUrl
                ? `<img class="live-card-thumb" src="${escapeHtml(liveImageUrl)}" alt="라이브 썸네일" onerror="this.parentElement.style.background='#1a2a40'">`
                : ""}
              <span class="live-card-badge live">LIVE</span>
            </div>
            <div class="live-card-info">
              <div class="live-card-title">${escapeHtml(liveTitle || "치지직 라이브 진행 중")}</div>
              <div class="live-card-meta">${escapeHtml(categoryName ? categoryName + " · " : "")}시청자 ${viewerCount.toLocaleString()}명</div>
            </div>
          </a>`;
      } else {
        card.style.cursor = "default";
        card.onclick = null;
        card.innerHTML = `
          <div class="status-badge" style="background:rgba(255,255,255,0.52);color:#6480a7;border-color:rgba(184,205,233,0.32);">OFFLINE</div>
          <div class="status-title">현재 치지직 방송은 오프라인 상태입니다.</div>
          <div class="status-desc">방송 시작 시 이 영역이 자동으로 업데이트됩니다.</div>`;
      }
    }

    if (youtubeLiveTitle) {
      youtubeLiveTitle.textContent = isLive ? (liveTitle || "치지직 라이브 진행 중") : "현재 치지직 방송 오프라인";
    }
    if (youtubeLiveDesc) {
      youtubeLiveDesc.textContent = isLive
        ? `시청자 ${viewerCount.toLocaleString()}명${categoryName ? " · " + categoryName : ""}`
        : "현재 진행 중인 치지직 방송이 없습니다.";
    }
    if (youtubeLiveLink) {
      youtubeLiveLink.href = isLive ? chzzkLiveUrl : chzzkChannelUrl;
      youtubeLiveLink.textContent = isLive ? "방송 바로가기" : "채널 바로가기";
    }
  }

  function renderYouTubeLatestVideo(items) {
    const first = (items || [])[0];
    if (youtubeLatestTitle) youtubeLatestTitle.textContent = first ? first.title : "최근 업로드가 없습니다.";
    if (youtubeLatestDesc) youtubeLatestDesc.textContent = first
      ? `${formatDateTimeLabel(first.published_at)} · ${formatDuration(first.duration_seconds)}`
      : "동기화된 최근 업로드가 없습니다.";
    if (youtubeLatestLink) {
      youtubeLatestLink.href = first?.youtube_url || "https://www.youtube.com/@ishawaddo";
      youtubeLatestLink.textContent = first ? "최신 영상 보기" : "채널 바로가기";
    }
  }

  let youtubeSearchQuery = "";

  function renderTabs(allVideos) {
    const tabWrap = document.getElementById("youtubeTabWrap");
    if (!tabWrap) return;

    const counts = { all: allVideos.length, video: 0, short: 0, music: 0 };
    allVideos.forEach(v => { if (counts[v.video_type] !== undefined) counts[v.video_type]++; });

    const tabs = [
      { key: "all",   label: "전체" },
      { key: "video", label: "일반 영상" },
      { key: "short", label: "쇼츠" },
      { key: "music", label: "노래" },
    ];

    tabWrap.innerHTML = tabs.map(tab => `
      <button class="yt-tab-btn${tab.key === currentTab ? " active" : ""}" data-tab="${tab.key}">
        ${tab.label}
        <span class="yt-tab-count">${counts[tab.key] ?? 0}</span>
      </button>
    `).join("");

    tabWrap.querySelectorAll(".yt-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.tab;
        currentPage = 1;
        tabWrap.querySelectorAll(".yt-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        applyFilter();
      });
    });

    if (!document.getElementById("youtubeSearchBar")) {
      const wrap = document.createElement("div");
      wrap.id = "youtubeSearchBar";
      wrap.className = "hub-search-bar";
      wrap.innerHTML = `
        <input type="text" class="hub-search-input" placeholder="영상 제목 검색..." value="${escapeHtml(youtubeSearchQuery)}">
        <button class="hub-search-clear" title="초기화">✕</button>`;
      tabWrap.insertAdjacentElement("afterend", wrap);

      wrap.querySelector(".hub-search-input").addEventListener("input", e => {
        youtubeSearchQuery = e.target.value;
        currentPage = 1;
        applyFilter();
      });
      wrap.querySelector(".hub-search-clear").addEventListener("click", () => {
        youtubeSearchQuery = "";
        wrap.querySelector(".hub-search-input").value = "";
        currentPage = 1;
        applyFilter();
      });
    }
  }

  function applyFilter() {
    let base = currentTab === "all"
      ? youtubeAllVideos
      : youtubeAllVideos.filter(v => v.video_type === currentTab);
    if (youtubeSearchQuery.trim()) {
      const q = youtubeSearchQuery.trim().toLowerCase();
      base = base.filter(v => v.title.toLowerCase().includes(q));
    }
    youtubeFiltered = base;
    renderPage(currentPage);
  }

  function renderPagination(current, total) {
    const existing = document.getElementById("youtubePagination");
    if (existing) existing.remove();
    if (total <= 1) return;

    const nav = document.createElement("div");
    nav.id = "youtubePagination";
    nav.className = "youtube-pagination";

    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn" + (current === 1 ? " disabled" : "");
    prevBtn.textContent = "←";
    prevBtn.disabled = current === 1;
    prevBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderPage(currentPage); } });
    nav.appendChild(prevBtn);

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `${current} / ${total}`;
    nav.appendChild(label);

    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn" + (current === total ? " disabled" : "");
    nextBtn.textContent = "→";
    nextBtn.disabled = current === total;
    nextBtn.addEventListener("click", () => { if (currentPage < total) { currentPage++; renderPage(currentPage); } });
    nav.appendChild(nextBtn);

    youtubeVideoGrid.insertAdjacentElement("afterend", nav);
  }

  function renderPage(page) {
    if (!youtubeVideoGrid) return;

    const totalPages = Math.ceil(youtubeFiltered.length / VIDEOS_PER_PAGE);
    const start = (page - 1) * VIDEOS_PER_PAGE;
    const pageItems = youtubeFiltered.slice(start, start + VIDEOS_PER_PAGE);

    if (!pageItems.length) {
      youtubeVideoGrid.innerHTML = `<div class="youtube-empty"><p>${youtubeSearchQuery.trim() ? "검색 결과가 없습니다." : "해당 카테고리의 영상이 없습니다."}</p></div>`;
      renderPagination(1, 0);
      return;
    }

    youtubeVideoGrid.innerHTML = pageItems.map(item => {
      const typeLabel = TYPE_LABEL[item.video_type] || item.video_type;
      return `
        <div class="youtube-card" data-video="${escapeHtml(item.video_id)}" data-url="${escapeHtml(item.youtube_url)}">
          <div class="youtube-thumb">
            <img src="${escapeHtml(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="youtube-duration">${formatDuration(item.duration_seconds)}</div>
            <span class="youtube-type-badge youtube-type-${escapeHtml(item.video_type)}">${typeLabel}</span>
          </div>
          <div class="youtube-info">
            <div class="youtube-title">${escapeHtml(item.title)}</div>
            <div class="youtube-meta">${formatDateTimeLabel(item.published_at)}</div>
          </div>
        </div>`;
    }).join("");

    youtubeVideoGrid.querySelectorAll(".youtube-card").forEach(card => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      });
    });

    renderPagination(page, totalPages);
  }

  function renderYouTubeGrid(items) {
    if (!youtubeVideoGrid) return;
    if (!items.length) {
      youtubeVideoGrid.innerHTML = `
        <article class="youtube-cache-card glass-card">
          <span class="card-mini-badge">EMPTY</span>
          <h3>동기화된 유튜브 데이터가 없습니다</h3>
          <p>먼저 유튜브 부트스트랩 또는 동기화를 실행해주세요.</p>
        </article>`;
      return;
    }
    youtubeAllVideos = items;
    youtubeFiltered = items;
    currentPage = 1;
    currentTab = "all";
    renderTabs(items);
    renderPage(currentPage);
  }

  async function loadMainPreview() {
    try {
      const [newsRes, scheduleRes] = await Promise.all([
        fetch("/api/isha/main/latest-news/"),
        fetch("/api/isha/main/upcoming-schedules/"),
      ]);
      const newsData = await newsRes.json();
      const scheduleData = await scheduleRes.json();
      if (!newsRes.ok || newsData.result !== "success") throw new Error(newsData.message || "최신 소식을 불러오지 못했습니다.");
      if (!scheduleRes.ok || scheduleData.result !== "success") throw new Error(scheduleData.message || "예정된 일정을 불러오지 못했습니다.");
      renderLatestNews(newsData.items || []);
      renderUpcomingSchedules(scheduleData.items || []);
      renderHeroPreview(newsData.items || [], scheduleData.items || []);
    } catch (error) {
      console.error(error);
      if (latestNewsGrid) latestNewsGrid.innerHTML = `
        <article class="update-card large">
          <span class="update-type">ERROR</span>
          <h3>최신 소식을 불러오지 못했습니다</h3>
          <p>잠시 후 다시 시도해주세요.</p>
          <a href="/news/" class="card-link">공지사항 페이지 이동</a>
        </article>`;
      if (upcomingScheduleTimeline) upcomingScheduleTimeline.innerHTML = `
        <article class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <span class="timeline-date">ERROR</span>
            <h3>예정된 일정을 불러오지 못했습니다</h3>
            <p>잠시 후 다시 시도해주세요.</p>
          </div>
        </article>`;
      if (heroPinnedTitle) heroPinnedTitle.textContent = "대표 공지를 불러오지 못했습니다.";
      if (heroPinnedSummary) heroPinnedSummary.textContent = "잠시 후 다시 시도해주세요.";
      if (heroNextScheduleTitle) heroNextScheduleTitle.textContent = "예정 일정을 불러오지 못했습니다.";
      if (heroNextScheduleSummary) heroNextScheduleSummary.textContent = "잠시 후 다시 시도해주세요.";
    }
  }

  async function loadChzzkLiveSection() {
    try {
      const res = await fetch("/api/isha/chzzk/live-status/");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "치지직 라이브 상태를 불러오지 못했습니다.");
      renderChzzkLiveStatus(data);
    } catch (error) {
      console.error(error);
      if (liveStatusBadge) liveStatusBadge.textContent = "ERROR";
      if (liveStatusTitle) liveStatusTitle.textContent = "치지직 상태를 불러오지 못했습니다.";
      if (liveStatusDesc) liveStatusDesc.textContent = "잠시 후 다시 시도해주세요.";
      if (youtubeLiveTitle) youtubeLiveTitle.textContent = "치지직 라이브 상태를 불러오지 못했습니다.";
      if (youtubeLiveDesc) youtubeLiveDesc.textContent = "잠시 후 다시 시도해주세요.";
    }
  }

  function formatCount(num) {
    const n = Number(num || 0);
    if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
    return n.toLocaleString();
  }

  async function loadChannelStats() {
    const chzzkFollowerEl  = document.getElementById("chzzkFollowerCount");
    const youtubeSubEl     = document.getElementById("youtubeSubscriberCount");

    try {
      const res = await fetch("/api/isha/chzzk/channels/");
      const data = await res.json();
      if (res.ok && data.success && data.channels.length) {
        const ch = data.channels[0];
        if (chzzkFollowerEl) chzzkFollowerEl.textContent = formatCount(ch.followerCount);
      }
    } catch (e) {
      console.error("치지직 채널 통계 오류", e);
      if (chzzkFollowerEl) chzzkFollowerEl.textContent = "—";
    }

    try {
      const res = await fetch("/api/isha/youtube/channel-stats/");
      const data = await res.json();
      if (res.ok && data.result === "success") {
        if (youtubeSubEl) youtubeSubEl.textContent = formatCount(data.channel.subscriber_count);
      }
    } catch (e) {
      console.error("유튜브 채널 통계 오류", e);
      if (youtubeSubEl) youtubeSubEl.textContent = "—";
    }
  }

  async function loadYouTubeSection() {
    try {
      const videosRes = await fetch("/api/isha/youtube/videos/");
      const videosData = await videosRes.json();
      if (!videosRes.ok || videosData.result !== "success") throw new Error(videosData.message || "유튜브 캐시 영상을 불러오지 못했습니다.");
      renderYouTubeLatestVideo(videosData.items || []);
      renderYouTubeGrid(videosData.items || []);
    } catch (error) {
      console.error(error);
      if (youtubeLatestTitle) youtubeLatestTitle.textContent = "최근 업로드를 불러오지 못했습니다.";
      if (youtubeLatestDesc) youtubeLatestDesc.textContent = "유튜브 캐시 동기화 상태를 확인해주세요.";
      if (youtubeVideoGrid) youtubeVideoGrid.innerHTML = `
        <article class="youtube-cache-card glass-card">
          <span class="card-mini-badge">ERROR</span>
          <h3>유튜브 캐시 데이터를 불러오지 못했습니다</h3>
          <p>먼저 /api/isha/youtube/bootstrap/ 호출 후 다시 시도해주세요.</p>
        </article>`;
    }
  }

  let chzzkAllVideos = [];
  let chzzkFiltered = [];
  let chzzkCurrentPage = 1;
  let chzzkCurrentTab = "all";
  const CHZZK_PER_PAGE = 6;

  const CHZZK_TYPE_LABEL = { replay: "다시보기", clip: "클립" };

  let chzzkSearchQuery = "";

  function renderChzzkTabs(allVideos) {
    const tabWrap = document.getElementById("chzzkTabWrap");
    if (!tabWrap) return;

    const counts = { all: allVideos.length, replay: 0, clip: 0 };
    allVideos.forEach(v => { if (counts[v.video_type] !== undefined) counts[v.video_type]++; });

    const tabs = [
      { key: "all",    label: "전체" },
      { key: "replay", label: "다시보기" },
      { key: "clip",   label: "클립" },
    ];

    tabWrap.innerHTML = tabs.map(tab => `
      <button class="yt-tab-btn${tab.key === chzzkCurrentTab ? " active" : ""}" data-tab="${tab.key}">
        ${tab.label}
        <span class="yt-tab-count">${counts[tab.key] ?? 0}</span>
      </button>
    `).join("");

    tabWrap.querySelectorAll(".yt-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        chzzkCurrentTab = btn.dataset.tab;
        chzzkCurrentPage = 1;
        tabWrap.querySelectorAll(".yt-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        applyChzzkFilter();
      });
    });

    if (!document.getElementById("chzzkSearchBar")) {
      const wrap = document.createElement("div");
      wrap.id = "chzzkSearchBar";
      wrap.className = "hub-search-bar";
      wrap.innerHTML = `
        <input type="text" class="hub-search-input" placeholder="영상 제목 검색..." value="${escapeHtml(chzzkSearchQuery)}">
        <button class="hub-search-clear" title="초기화">✕</button>`;
      tabWrap.insertAdjacentElement("afterend", wrap);

      wrap.querySelector(".hub-search-input").addEventListener("input", e => {
        chzzkSearchQuery = e.target.value;
        chzzkCurrentPage = 1;
        applyChzzkFilter();
      });
      wrap.querySelector(".hub-search-clear").addEventListener("click", () => {
        chzzkSearchQuery = "";
        wrap.querySelector(".hub-search-input").value = "";
        chzzkCurrentPage = 1;
        applyChzzkFilter();
      });
    }
  }

  function applyChzzkFilter() {
    let base = chzzkCurrentTab === "all"
      ? chzzkAllVideos
      : chzzkAllVideos.filter(v => v.video_type === chzzkCurrentTab);
    if (chzzkSearchQuery.trim()) {
      const q = chzzkSearchQuery.trim().toLowerCase();
      base = base.filter(v => v.title.toLowerCase().includes(q));
    }
    chzzkFiltered = base;
    renderChzzkPage(chzzkCurrentPage);
  }

  function renderChzzkPagination(current, total) {
    const existing = document.getElementById("chzzkPagination");
    if (existing) existing.remove();
    if (total <= 1) return;

    const grid = document.getElementById("chzzkVideoGrid");
    if (!grid) return;

    const nav = document.createElement("div");
    nav.id = "chzzkPagination";
    nav.className = "youtube-pagination";

    const prevBtn = document.createElement("button");
    prevBtn.className = "page-btn" + (current === 1 ? " disabled" : "");
    prevBtn.textContent = "←";
    prevBtn.disabled = current === 1;
    prevBtn.addEventListener("click", () => { if (chzzkCurrentPage > 1) { chzzkCurrentPage--; renderChzzkPage(chzzkCurrentPage); } });
    nav.appendChild(prevBtn);

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `${current} / ${total}`;
    nav.appendChild(label);

    const nextBtn = document.createElement("button");
    nextBtn.className = "page-btn" + (current === total ? " disabled" : "");
    nextBtn.textContent = "→";
    nextBtn.disabled = current === total;
    nextBtn.addEventListener("click", () => { if (chzzkCurrentPage < total) { chzzkCurrentPage++; renderChzzkPage(chzzkCurrentPage); } });
    nav.appendChild(nextBtn);

    grid.insertAdjacentElement("afterend", nav);
  }

  function renderChzzkPage(page) {
    const grid = document.getElementById("chzzkVideoGrid");
    if (!grid) return;

    const totalPages = Math.ceil(chzzkFiltered.length / CHZZK_PER_PAGE);
    const start = (page - 1) * CHZZK_PER_PAGE;
    const pageItems = chzzkFiltered.slice(start, start + CHZZK_PER_PAGE);

    if (!pageItems.length) {
      grid.innerHTML = `<div class="youtube-empty"><p>${chzzkSearchQuery.trim() ? "검색 결과가 없습니다." : "해당 카테고리의 영상이 없습니다."}</p></div>`;
      renderChzzkPagination(1, 0);
      return;
    }

    grid.innerHTML = pageItems.map(item => {
      const typeLabel = CHZZK_TYPE_LABEL[item.video_type] || item.video_type;
      const typeClass = item.video_type === "clip" ? "chzzk-type-clip" : "chzzk-type-replay";
      return `
        <div class="youtube-card" data-url="${escapeHtml(item.chzzk_url)}" style="cursor:pointer">
          <div class="youtube-thumb">
            <img src="${escapeHtml(item.thumbnail_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
            <div class="youtube-duration">${formatDuration(item.duration_seconds)}</div>
            <span class="youtube-type-badge ${typeClass}">${typeLabel}</span>
          </div>
          <div class="youtube-info">
            <div class="youtube-title">${escapeHtml(item.title)}</div>
            <div class="youtube-meta">${formatDateTimeLabel(item.publish_date)}${item.video_category_value ? " · " + escapeHtml(item.video_category_value) : ""}</div>
          </div>
        </div>`;
    }).join("");

    grid.querySelectorAll(".youtube-card").forEach(card => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      });
    });

    renderChzzkPagination(page, totalPages);
  }

  async function loadChzzkVideoSection() {
    const grid = document.getElementById("chzzkVideoGrid");
    try {
      const res = await fetch("/api/isha/chzzk/videos/");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "치지직 영상을 불러오지 못했습니다.");

      const items = data.items || [];
      if (!items.length) {
        if (grid) grid.innerHTML = `
          <article class="youtube-cache-card glass-card">
            <span class="card-mini-badge">EMPTY</span>
            <h3>동기화된 치지직 영상이 없습니다</h3>
            <p>/api/isha/chzzk/videos/sync/ 를 먼저 호출해주세요.</p>
          </article>`;
        return;
      }

      chzzkAllVideos = items;
      chzzkFiltered = items;
      chzzkCurrentPage = 1;
      chzzkCurrentTab = "all";
      renderChzzkTabs(items);
      renderChzzkPage(chzzkCurrentPage);
    } catch (error) {
      console.error(error);
      if (grid) grid.innerHTML = `
        <article class="youtube-cache-card glass-card">
          <span class="card-mini-badge">ERROR</span>
          <h3>치지직 영상을 불러오지 못했습니다</h3>
          <p>잠시 후 다시 시도해주세요.</p>
        </article>`;
    }
  }

  let cafeAllPosts = [];
  let cafeCurrentTab = "community";
  const CAFE_TYPE_LABEL = { notice: "가입 인사", community: "이샤의 공지" };

  let cafeSearchQuery = "";

  function renderCafeTabs(posts) {
    const tabWrap = document.getElementById("cafeTabWrap");
    if (!tabWrap) return;

    const counts = { notice: 0, community: 0 };
    posts.forEach(p => { if (counts[p.board_type] !== undefined) counts[p.board_type]++; });

    tabWrap.innerHTML = [
      { key: "community", label: "이샤가 남겨요" },
      { key: "notice",    label: "가입 인사" },
    ].map(tab => `
      <button class="yt-tab-btn${tab.key === cafeCurrentTab ? " active" : ""}" data-tab="${tab.key}">
        ${tab.label}
        <span class="yt-tab-count">${counts[tab.key] ?? 0}</span>
      </button>
    `).join("");

    tabWrap.querySelectorAll(".yt-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        cafeCurrentTab = btn.dataset.tab;
        tabWrap.querySelectorAll(".yt-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderCafePosts();
      });
    });

    if (!document.getElementById("cafeSearchBar")) {
      const wrap = document.createElement("div");
      wrap.id = "cafeSearchBar";
      wrap.className = "hub-search-bar";
      wrap.innerHTML = `
        <input type="text" class="hub-search-input" placeholder="게시글 제목 검색..." value="${escapeHtml(cafeSearchQuery)}">
        <button class="hub-search-clear" title="초기화">✕</button>`;
      tabWrap.insertAdjacentElement("afterend", wrap);

      wrap.querySelector(".hub-search-input").addEventListener("input", e => {
        cafeSearchQuery = e.target.value;
        renderCafePosts();
      });
      wrap.querySelector(".hub-search-clear").addEventListener("click", () => {
        cafeSearchQuery = "";
        wrap.querySelector(".hub-search-input").value = "";
        renderCafePosts();
      });
    }
  }

  function formatCafeDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}분 전`;
    const hour = Math.floor(min / 60);
    if (hour < 24) return `${hour}시간 전`;
    const day = Math.floor(hour / 24);
    if (day < 7) return `${day}일 전`;
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
  }

  function renderCafePosts() {
    const grid = document.getElementById("cafePostGrid");
    const moreWrap = document.getElementById("cafeMoreWrap");
    if (!grid) return;

    let items = cafeAllPosts.filter(p => p.board_type === cafeCurrentTab);
    if (cafeSearchQuery.trim()) {
      const q = cafeSearchQuery.trim().toLowerCase();
      items = items.filter(p => p.subject.toLowerCase().includes(q));
    }

    if (!items.length) {
      grid.innerHTML = `<div class="youtube-empty"><p>${cafeSearchQuery.trim() ? "검색 결과가 없습니다." : "게시글이 없습니다."}</p></div>`;
      if (moreWrap) moreWrap.style.display = "none";
      return;
    }

    grid.innerHTML = items.map(p => `
      <a class="cafe-post-card glass-card" href="${escapeHtml(p.cafe_url)}" target="_blank" rel="noopener noreferrer">
        <div class="cafe-post-body">
          <span class="cafe-post-badge">${CAFE_TYPE_LABEL[p.board_type] || p.board_type}</span>
          <div class="cafe-post-title">${escapeHtml(p.subject)}</div>
          <div class="cafe-post-meta">
            <span>${escapeHtml(p.writer_nickname)}</span>
            <span>·</span>
            <span>${formatCafeDate(p.write_date_timestamp)}</span>
            <span>·</span>
            <span>💬 ${p.comment_count.toLocaleString()}</span>
            <span>❤ ${p.like_it_count.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `).join("");

    if (moreWrap) moreWrap.style.display = "flex";
  }

  async function loadCafeSection() {
    const grid = document.getElementById("cafePostGrid");
    try {
      const res = await fetch("/api/isha/cafe/posts/?limit=30");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "카페 글을 불러오지 못했습니다.");

      const items = data.items || [];
      if (!items.length) {
        if (grid) grid.innerHTML = `
          <article class="youtube-cache-card glass-card">
            <span class="card-mini-badge">EMPTY</span>
            <h3>동기화된 카페 글이 없습니다</h3>
            <p>/api/isha/cafe/sync/ 를 먼저 호출해주세요.</p>
          </article>`;
        return;
      }

      cafeAllPosts = items;
      renderCafeTabs(items);
      renderCafePosts();
    } catch (err) {
      console.error(err);
      if (grid) grid.innerHTML = `
        <article class="youtube-cache-card glass-card">
          <span class="card-mini-badge">ERROR</span>
          <h3>카페 글을 불러오지 못했습니다</h3>
          <p>잠시 후 다시 시도해주세요.</p>
        </article>`;
    }
  }

  loadMainPreview();
  loadChzzkLiveSection();
  loadChannelStats();
  loadChzzkVideoSection();
  loadYouTubeSection();
  loadCafeSection();
});