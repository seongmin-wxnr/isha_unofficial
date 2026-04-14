document.addEventListener("DOMContentLoaded", () => {
  const revealItems = document.querySelectorAll(".reveal");
  const featuredTitle = document.getElementById("featuredTitle");
  const featuredDesc = document.getElementById("featuredDesc");
  const featuredIndex = document.getElementById("featuredIndex");
  const featuredTag = document.getElementById("featuredTag");
  const featuredImage = document.getElementById("featuredImage");

  const latestNewsGrid = document.getElementById("latestNewsGrid");
  const upcomingScheduleTimeline = document.getElementById("upcomingScheduleTimeline");

  const heroPinnedTitle = document.getElementById("heroPinnedTitle");
  const heroPinnedSummary = document.getElementById("heroPinnedSummary");
  const heroNextScheduleTitle = document.getElementById("heroNextScheduleTitle");
  const heroNextScheduleSummary = document.getElementById("heroNextScheduleSummary");

  const liveStatusBadge = document.getElementById("liveStatusBadge");
  const liveStatusTitle = document.getElementById("liveStatusTitle");
  const liveStatusDesc = document.getElementById("liveStatusDesc");

  const youtubeMainFrame = document.getElementById("youtubeMainFrame");
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
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));

  const featuredScenes = [
    {
      title: "하얀 북극 여우",
      desc: "밝은 분위기와 연약한(?)이미지의 북극 여우 '이샤' 입니다. 항상 이또들의 즐거움을 위해 노력하는 이샤를 위해 박수 쳐 주세요 !",
      index: "누구냐 너",
      tag: "여성 · 북극여우",
      image: "/static/img/isha_int.png"
    },
    {
      title: "그녀의 생일",
      desc: "이샤의 생일은 2월 4일 입니다. 모두 그녀의 생일을 함께 축하해주자고요! 또한 공식 팬카페에서 생일때 마다 예쁜 이샤의 모습을 선물해주기도 합니다.",
      index: "생일",
      tag: "여성 · 북극여우 · 02.04",
      image: "/static/img/isha_int.png"
    },
    {
      title: "이또 ! 당신 !",
      desc: "이샤의 노력도 있겠지만, 이또들이 없었다면 지금의 이샤도 없었을거라 생각합니다. 고맙습니다 이샤 , 이또 !",
      index: "모두의 노력",
      tag: "항상 고마워요",
      image: "/static/img/isha_int.png"
    }
  ];

  let currentScene = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function updateScene(scene) {
    if (!featuredTitle || !featuredDesc || !featuredIndex || !featuredTag || !featuredImage) return;

    featuredImage.classList.add("is-changing");

    setTimeout(() => {
      featuredTitle.textContent = scene.title;
      featuredDesc.textContent = scene.desc;
      featuredIndex.textContent = scene.index;
      featuredTag.textContent = scene.tag;
      featuredImage.src = scene.image;
      featuredImage.alt = scene.title;
      featuredImage.classList.remove("is-changing");
    }, 220);
  }

  function formatNoticeType(category) {
    const map = {
      notice: "NOTICE",
      important: "IMPORTANT",
      update: "UPDATE",
      schedule: "SCHEDULE",
      archive: "ARCHIVE",
    };
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

    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
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
        </article>
      `;
      return;
    }

    latestNewsGrid.innerHTML = items
      .map((item, index) => {
        const largeClass = index === 0 ? "large" : "";
        const summary = item.summary || item.preview || "공지사항 페이지에서 자세한 내용을 확인해보세요.";
        return `
          <article class="update-card ${largeClass}">
            <span class="update-type">${escapeHtml(formatNoticeType(item.category))}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(summary)}</p>
            <a href="/news/" class="card-link">${escapeHtml(item.date)} · 자세히 보기</a>
          </article>
        `;
      })
      .join("");
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
        </article>
      `;
      return;
    }

    upcomingScheduleTimeline.innerHTML = items
      .map((item) => {
        const timeText = item.end_time
          ? `${item.start_time} - ${item.end_time}`
          : item.start_time || "시간 미정";

        const subtitle = item.subtitle || "추가 설명이 없습니다.";

        return `
          <article class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-date">${escapeHtml(formatDateLabel(item.date))} · ${escapeHtml(timeText)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(subtitle)}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderHeroPreview(newsItems, scheduleItems) {
    const pinned = (newsItems || []).find((item) => item.pinned) || (newsItems || [])[0];
    const nextSchedule = (scheduleItems || [])[0];

    if (heroPinnedTitle) {
      heroPinnedTitle.textContent = pinned ? pinned.title : "대표 공지가 없습니다.";
    }

    if (heroPinnedSummary) {
      heroPinnedSummary.textContent = pinned
        ? (pinned.summary || pinned.preview || "공지사항 페이지에서 자세한 내용을 확인해보세요.")
        : "아직 등록된 공지가 없습니다.";
    }

    if (heroNextScheduleTitle) {
      heroNextScheduleTitle.textContent = nextSchedule ? nextSchedule.title : "예정된 일정이 없습니다.";
    }

    if (heroNextScheduleSummary) {
      if (nextSchedule) {
        const timeText = nextSchedule.end_time
          ? `${nextSchedule.start_time} - ${nextSchedule.end_time}`
          : nextSchedule.start_time || "시간 미정";
        heroNextScheduleSummary.textContent =
          `${formatDateLabel(nextSchedule.date)} · ${timeText} · ${nextSchedule.subtitle || "추가 설명 없음"}`;
      } else {
        heroNextScheduleSummary.textContent = "현재 등록된 예정 일정이 없습니다.";
      }
    }
  }

  function renderYouTubeLiveStatus(item) {
    const isLive = Boolean(item?.is_live);

    if (liveStatusBadge) liveStatusBadge.textContent = isLive ? "LIVE" : "OFFLINE";
    if (liveStatusTitle) {
      liveStatusTitle.textContent = isLive
        ? "유튜브 라이브가 진행 중입니다."
        : "현재 유튜브 라이브는 오프라인 상태입니다.";
    }
    if (liveStatusDesc) {
      liveStatusDesc.textContent = isLive
        ? (item.title || "진행 중인 방송 제목을 불러왔습니다.")
        : "가장 최근 업로드와 예정된 일정을 확인해보세요.";
    }

    if (youtubeLiveTitle) {
      youtubeLiveTitle.textContent = isLive
        ? (item.title || "현재 라이브 진행 중")
        : "현재 유튜브 라이브 오프라인";
    }

    if (youtubeLiveDesc) {
      youtubeLiveDesc.textContent = isLive
        ? "지금 바로 라이브 방송으로 이동할 수 있습니다."
        : "현재 진행 중인 유튜브 라이브는 없습니다.";
    }

    if (youtubeLiveLink) {
      youtubeLiveLink.href = isLive && item.video_id
        ? `https://www.youtube.com/watch?v=${item.video_id}`
        : "https://www.youtube.com/@ishawaddo";
      youtubeLiveLink.textContent = isLive ? "라이브 바로가기" : "채널 바로가기";
    }

    if (isLive && youtubeMainFrame && item.video_id) {
      youtubeMainFrame.src = `https://www.youtube-nocookie.com/embed/${item.video_id}`;
      youtubeMainFrame.title = item.title || "Isha Live";
    }
  }

  function renderYouTubeLatestVideo(items) {
    const first = (items || [])[0];

    if (youtubeLatestTitle) {
      youtubeLatestTitle.textContent = first
        ? first.title
        : "최근 업로드가 없습니다.";
    }

    if (youtubeLatestDesc) {
      youtubeLatestDesc.textContent = first
        ? `${formatDateTimeLabel(first.published_at)} · ${formatDuration(first.duration_seconds)}`
        : "동기화된 최근 업로드가 없습니다.";
    }

    if (youtubeLatestLink) {
      youtubeLatestLink.href = first?.youtube_url || "https://www.youtube.com/@ishawaddo";
      youtubeLatestLink.textContent = first ? "최신 영상 보기" : "채널 바로가기";
    }

    if (first && youtubeMainFrame) {
      youtubeMainFrame.src = `https://www.youtube-nocookie.com/embed/${first.video_id}`;
      youtubeMainFrame.title = first.title || "Isha YouTube Video";
    }
  }

  function renderYouTubeGrid(items) {
    if (!youtubeVideoGrid) return;

    if (!items.length) {
      youtubeVideoGrid.innerHTML = `
        <article class="youtube-cache-card glass-card">
          <span class="card-mini-badge">EMPTY</span>
          <h3>동기화된 유튜브 데이터가 없습니다</h3>
          <p>먼저 유튜브 부트스트랩 또는 동기화를 실행해주세요.</p>
        </article>
      `;
      return;
    }

    youtubeVideoGrid.innerHTML = items
      .map((item) => {
        return `
          <article class="youtube-cache-card glass-card">
            <span class="card-mini-badge">${escapeHtml(String(item.video_type || "video").toUpperCase())}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(formatDateTimeLabel(item.published_at))} · ${escapeHtml(formatDuration(item.duration_seconds))}</p>
            <a href="${escapeHtml(item.youtube_url)}" target="_blank" rel="noopener noreferrer" class="card-link">유튜브에서 보기</a>
          </article>
        `;
      })
      .join("");
  }

  async function loadMainPreview() {
    try {
      const [newsRes, scheduleRes] = await Promise.all([
        fetch("/api/isha/main/latest-news/"),
        fetch("/api/isha/main/upcoming-schedules/"),
      ]);

      const newsData = await newsRes.json();
      const scheduleData = await scheduleRes.json();

      if (!newsRes.ok || newsData.result !== "success") {
        throw new Error(newsData.message || "최신 소식을 불러오지 못했습니다.");
      }

      if (!scheduleRes.ok || scheduleData.result !== "success") {
        throw new Error(scheduleData.message || "예정된 일정을 불러오지 못했습니다.");
      }

      const newsItems = newsData.items || [];
      const scheduleItems = scheduleData.items || [];

      renderLatestNews(newsItems);
      renderUpcomingSchedules(scheduleItems);
      renderHeroPreview(newsItems, scheduleItems);
    } catch (error) {
      console.error(error);

      if (latestNewsGrid) {
        latestNewsGrid.innerHTML = `
          <article class="update-card large">
            <span class="update-type">ERROR</span>
            <h3>최신 소식을 불러오지 못했습니다</h3>
            <p>잠시 후 다시 시도해주세요.</p>
            <a href="/news/" class="card-link">공지사항 페이지 이동</a>
          </article>
        `;
      }

      if (upcomingScheduleTimeline) {
        upcomingScheduleTimeline.innerHTML = `
          <article class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-date">ERROR</span>
              <h3>예정된 일정을 불러오지 못했습니다</h3>
              <p>잠시 후 다시 시도해주세요.</p>
            </div>
          </article>
        `;
      }

      if (heroPinnedTitle) heroPinnedTitle.textContent = "대표 공지를 불러오지 못했습니다.";
      if (heroPinnedSummary) heroPinnedSummary.textContent = "잠시 후 다시 시도해주세요.";
      if (heroNextScheduleTitle) heroNextScheduleTitle.textContent = "예정 일정을 불러오지 못했습니다.";
      if (heroNextScheduleSummary) heroNextScheduleSummary.textContent = "잠시 후 다시 시도해주세요.";
    }
  }

  async function loadYouTubeSection() {
    try {
      const [liveRes, videosRes] = await Promise.all([
        fetch("/api/isha/youtube/live-status/"),
        fetch("/api/isha/youtube/videos/?limit=6"),
      ]);

      const liveData = await liveRes.json();
      const videosData = await videosRes.json();

      if (!liveRes.ok || liveData.result !== "success") {
        throw new Error(liveData.message || "유튜브 라이브 상태를 불러오지 못했습니다.");
      }

      if (!videosRes.ok || videosData.result !== "success") {
        throw new Error(videosData.message || "유튜브 캐시 영상을 불러오지 못했습니다.");
      }

      const videoItems = videosData.items || [];

      renderYouTubeLiveStatus(liveData.item || {});
      renderYouTubeLatestVideo(videoItems);
      renderYouTubeGrid(videoItems);
    } catch (error) {
      console.error(error);

      if (liveStatusBadge) liveStatusBadge.textContent = "ERROR";
      if (liveStatusTitle) liveStatusTitle.textContent = "유튜브 상태를 불러오지 못했습니다.";
      if (liveStatusDesc) liveStatusDesc.textContent = "먼저 유튜브 bootstrap 또는 sync를 확인해주세요.";

      if (youtubeLiveTitle) youtubeLiveTitle.textContent = "유튜브 라이브 상태를 불러오지 못했습니다.";
      if (youtubeLiveDesc) youtubeLiveDesc.textContent = "bootstrap 또는 sync를 먼저 실행해주세요.";

      if (youtubeLatestTitle) youtubeLatestTitle.textContent = "최근 업로드를 불러오지 못했습니다.";
      if (youtubeLatestDesc) youtubeLatestDesc.textContent = "유튜브 캐시 동기화 상태를 확인해주세요.";

      if (youtubeVideoGrid) {
        youtubeVideoGrid.innerHTML = `
          <article class="youtube-cache-card glass-card">
            <span class="card-mini-badge">ERROR</span>
            <h3>유튜브 캐시 데이터를 불러오지 못했습니다</h3>
            <p>먼저 /api/isha/youtube/bootstrap/ 호출 후 다시 시도해주세요.</p>
          </article>
        `;
      }
    }
  }

  if (featuredTitle && featuredDesc && featuredIndex && featuredTag && featuredImage) {
    updateScene(featuredScenes[0]);

    setInterval(() => {
      currentScene = (currentScene + 1) % featuredScenes.length;
      updateScene(featuredScenes[currentScene]);
    }, 5000);
  }

  loadMainPreview();
  loadYouTubeSection();
});