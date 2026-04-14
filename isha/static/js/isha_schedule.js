const scheduleAvatarMap = {
  stream: "/static/img/fan/fan_source.png",
  notice: "/static/img/fan/fan_source.png",
  event: "/static/img/fan/fan_source.png",
  etc: "/static/img/fan/fan_source.png",
};

(() => {
  const isStaff = Boolean(window.ISHA_IS_AUTHENTICATED && window.ISHA_IS_STAFF);
  const schedules = [];
  let currentWeekStart = getMonday(new Date());
  let editingItemId = null;
  let selectedScheduleId = null;

  const typeLabels = {
    stream: "방송",
    notice: "공지",
    event: "이벤트",
    etc: "기타",
  };

  function pad(num) {
    return String(num).padStart(2, "0");
  }

  function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diff = d.getDate() - ((d.getDay() + 6) % 7);
    d.setDate(diff);
    return d;
  }

  function formatIsoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatWeekRange(start) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getFullYear()}.${pad(start.getMonth() + 1)}.${pad(start.getDate())} - ${end.getFullYear()}.${pad(end.getMonth() + 1)}.${pad(end.getDate())}`;
  }

  function getCSRFToken() {
    return (
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1] || ""
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setupReveal() {
    const revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  function updateStats(days = []) {
    const totalEl = document.getElementById("totalSchedules");
    const activeDaysEl = document.getElementById("activeDays");
    const currentWeekLabelEl = document.getElementById("currentWeekLabel");
    const modeEl = document.getElementById("scheduleModeLabel");

    const activeDayCount = days.filter((day) => (day.items || []).length > 0).length;

    if (totalEl) totalEl.textContent = schedules.length;
    if (activeDaysEl) activeDaysEl.innerHTML = `${activeDayCount}<span>일</span>`;
    if (currentWeekLabelEl) {
      currentWeekLabelEl.textContent = `${currentWeekStart.getMonth() + 1}월 ${Math.ceil(
        currentWeekStart.getDate() / 7
      )}주차`;
    }
    if (modeEl) modeEl.innerHTML = isStaff ? "관리<span>가능</span>" : "읽기<span>전용</span>";
  }

  function buildAvatar(item) {
    const typeKey = item.type || "stream";
    const avatarSrc = scheduleAvatarMap[typeKey] || "/static/img/fan/fan_source.png";
    return `<img class="schedule-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(typeLabels[typeKey] || "ISHA")}">`;
  }

  function buildCard(item) {
    const timeText = item.end_time ? `${item.start_time} - ${item.end_time}` : item.start_time;

    return `
      <button class="schedule-card color-${escapeHtml(item.color || "blue")}" type="button" data-id="${item.id}">
        ${buildAvatar(item)}
        <div class="schedule-info">
          <div class="schedule-title">${escapeHtml(item.title)}</div>
          ${item.subtitle ? `<div class="schedule-subtitle">${escapeHtml(item.subtitle)}</div>` : ""}
        </div>
        <div class="schedule-time">${escapeHtml(timeText)}</div>
      </button>
    `;
  }

  function renderBoard(days) {
    const board = document.getElementById("scheduleBoard");
    if (!board) return;

    board.innerHTML = days
      .map(
        (day) => `
        <div class="schedule-row">
          <div class="schedule-row-header">${escapeHtml(day.label)}</div>
          <div class="schedule-row-body" data-date="${escapeHtml(day.date)}">
            ${
              day.items.length
                ? day.items.map(buildCard).join("")
                : '<div class="schedule-empty">등록된 일정이 없습니다.</div>'
            }
          </div>
        </div>
      `
      )
      .join("");

    board.querySelectorAll(".schedule-card").forEach((card) => {
      card.addEventListener("click", () => {
        const item = schedules.find((entry) => Number(entry.id) === Number(card.dataset.id));
        if (!item) return;
        openReadModal(item);
      });
    });
  }

  async function loadSchedules() {
    const weekRangeLabel = document.getElementById("weekRangeLabel");
    if (weekRangeLabel) weekRangeLabel.textContent = "불러오는 중...";

    try {
      const response = await fetch(`/api/isha/schedule/list/?week_start=${formatIsoDate(currentWeekStart)}`);
      const data = await response.json();

      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "일정을 불러오지 못했습니다.");
      }

      schedules.length = 0;
      (data.days || []).forEach((day) => {
        (day.items || []).forEach((item) => schedules.push(item));
      });

      if (weekRangeLabel) weekRangeLabel.textContent = formatWeekRange(currentWeekStart);
      renderBoard(data.days || []);
      updateStats(data.days || []);
    } catch (error) {
      console.error(error);
      if (weekRangeLabel) weekRangeLabel.textContent = "일정 로드 실패";

      const board = document.getElementById("scheduleBoard");
      if (board) {
        board.innerHTML =
          '<div class="schedule-empty" style="padding:48px; width:100%;">일정을 불러오지 못했습니다.</div>';
      }

      updateStats([]);
    }
  }

  function openModalById(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModalById(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function openReadModal(item) {
    selectedScheduleId = item.id;

    const typeEl = document.getElementById("scheduleReadType");
    const titleEl = document.getElementById("scheduleReadTitle");
    const metaEl = document.getElementById("scheduleReadMeta");
    const infoEl = document.getElementById("scheduleReadInfo");
    const descEl = document.getElementById("scheduleReadDesc");

    if (typeEl) typeEl.textContent = typeLabels[item.type] || "일정";
    if (titleEl) titleEl.textContent = item.title || "제목 없음";

    if (metaEl) {
      metaEl.innerHTML = `
        <span>📅 ${escapeHtml(item.date || "")}</span>
        <span>⏰ ${escapeHtml(item.end_time ? `${item.start_time} - ${item.end_time}` : item.start_time || "")}</span>
        <span>🎨 ${escapeHtml(item.color || "blue")}</span>
      `;
    }

    if (infoEl) {
      infoEl.innerHTML = `
        <strong>일정 유형</strong>: ${escapeHtml(typeLabels[item.type] || "일정")}<br>
        <strong>시간</strong>: ${escapeHtml(item.end_time ? `${item.start_time} - ${item.end_time}` : item.start_time || "")}<br>
        <strong>정렬 순서</strong>: ${escapeHtml(item.sort_order ?? 0)}
      `;
    }

    if (descEl) {
      descEl.textContent = item.subtitle || "추가 설명이 없습니다.";
    }

    openModalById("scheduleReadModal");
  }

  function resetForm() {
    if (!isStaff) return;

    const editId = document.getElementById("scheduleEditId");
    const dateInput = document.getElementById("scheduleDateInput");
    const typeInput = document.getElementById("scheduleTypeInput");
    const colorInput = document.getElementById("scheduleColorInput");
    const titleInput = document.getElementById("scheduleTitleInput");
    const subtitleInput = document.getElementById("scheduleSubtitleInput");
    const startInput = document.getElementById("scheduleStartTimeInput");
    const endInput = document.getElementById("scheduleEndTimeInput");
    const sortInput = document.getElementById("scheduleSortOrderInput");
    const deleteBtn = document.getElementById("scheduleDeleteBtn");

    editingItemId = null;
    if (editId) editId.value = "";
    if (dateInput) dateInput.value = formatIsoDate(currentWeekStart);
    if (typeInput) typeInput.value = "stream";
    if (colorInput) colorInput.value = "blue";
    if (titleInput) titleInput.value = "";
    if (subtitleInput) subtitleInput.value = "";
    if (startInput) startInput.value = "20:00";
    if (endInput) endInput.value = "";
    if (sortInput) sortInput.value = "0";
    if (deleteBtn) deleteBtn.style.display = "none";
  }

  function openCreateModal() {
    if (!isStaff) return;
    resetForm();
    openModalById("scheduleModal");
  }

  function openEditModal(item) {
    if (!isStaff) return;

    const editId = document.getElementById("scheduleEditId");
    const dateInput = document.getElementById("scheduleDateInput");
    const typeInput = document.getElementById("scheduleTypeInput");
    const colorInput = document.getElementById("scheduleColorInput");
    const titleInput = document.getElementById("scheduleTitleInput");
    const subtitleInput = document.getElementById("scheduleSubtitleInput");
    const startInput = document.getElementById("scheduleStartTimeInput");
    const endInput = document.getElementById("scheduleEndTimeInput");
    const sortInput = document.getElementById("scheduleSortOrderInput");
    const deleteBtn = document.getElementById("scheduleDeleteBtn");

    editingItemId = item.id;
    if (editId) editId.value = item.id;
    if (dateInput) dateInput.value = item.date;
    if (typeInput) typeInput.value = item.type || "stream";
    if (colorInput) colorInput.value = item.color || "blue";
    if (titleInput) titleInput.value = item.title || "";
    if (subtitleInput) subtitleInput.value = item.subtitle || "";
    if (startInput) startInput.value = item.start_time || "";
    if (endInput) endInput.value = item.end_time || "";
    if (sortInput) sortInput.value = item.sort_order ?? 0;
    if (deleteBtn) deleteBtn.style.display = "inline-flex";

    openModalById("scheduleModal");
  }

  function buildFormData() {
    const formData = new FormData();
    formData.append("schedule_date", document.getElementById("scheduleDateInput")?.value || "");
    formData.append("type", document.getElementById("scheduleTypeInput")?.value || "stream");
    formData.append("color", document.getElementById("scheduleColorInput")?.value || "blue");
    formData.append("title", document.getElementById("scheduleTitleInput")?.value.trim() || "");
    formData.append("subtitle", document.getElementById("scheduleSubtitleInput")?.value.trim() || "");
    formData.append("start_time", document.getElementById("scheduleStartTimeInput")?.value || "");
    formData.append("end_time", document.getElementById("scheduleEndTimeInput")?.value || "");
    formData.append("sort_order", document.getElementById("scheduleSortOrderInput")?.value || "0");
    return formData;
  }

  async function submitSchedule() {
    if (!isStaff) return;

    const title = document.getElementById("scheduleTitleInput")?.value.trim() || "";
    const date = document.getElementById("scheduleDateInput")?.value || "";
    const startTime = document.getElementById("scheduleStartTimeInput")?.value || "";

    if (!title || !date || !startTime) {
      alert("날짜, 제목, 시작 시간은 필수입니다.");
      return;
    }

    const formData = buildFormData();
    const url = editingItemId
      ? `/api/isha/schedule/${editingItemId}/update/`
      : "/api/isha/schedule/create/";

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: { "X-CSRFToken": getCSRFToken() },
      });

      const data = await response.json();

      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "일정 저장에 실패했습니다.");
      }

      closeModalById("scheduleModal");
      resetForm();
      await loadSchedules();
      alert(editingItemId ? "일정이 수정되었습니다." : "일정이 등록되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error.message || "일정 저장 중 오류가 발생했습니다.");
    }
  }

  async function deleteSchedule() {
    if (!isStaff || !editingItemId) return;
    if (!confirm("이 일정을 삭제할까요?")) return;

    try {
      const response = await fetch(`/api/isha/schedule/${editingItemId}/delete/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCSRFToken() },
      });

      const data = await response.json();
      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "일정 삭제에 실패했습니다.");
      }

      closeModalById("scheduleModal");
      resetForm();
      await loadSchedules();
      alert("일정이 삭제되었습니다.");
    } catch (error) {
      console.error(error);
      alert(error.message || "일정 삭제 중 오류가 발생했습니다.");
    }
  }

  function bindEvents() {
    document.getElementById("prevWeekBtn")?.addEventListener("click", async () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      currentWeekStart = getMonday(currentWeekStart);
      await loadSchedules();
    });

    document.getElementById("nextWeekBtn")?.addEventListener("click", async () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      currentWeekStart = getMonday(currentWeekStart);
      await loadSchedules();
    });

    document.getElementById("todayWeekBtn")?.addEventListener("click", async () => {
      currentWeekStart = getMonday(new Date());
      await loadSchedules();
    });

    document.getElementById("scheduleAdminFab")?.addEventListener("click", openCreateModal);

    document.getElementById("scheduleModalClose")?.addEventListener("click", () => {
      closeModalById("scheduleModal");
      resetForm();
    });

    document.getElementById("scheduleReadModalClose")?.addEventListener("click", () => {
      closeModalById("scheduleReadModal");
    });

    document.getElementById("scheduleEditFromReadBtn")?.addEventListener("click", () => {
      if (!isStaff) return;
      const item = schedules.find((entry) => Number(entry.id) === Number(selectedScheduleId));
      if (!item) return;
      closeModalById("scheduleReadModal");
      openEditModal(item);
    });

    document.getElementById("scheduleSubmitBtn")?.addEventListener("click", submitSchedule);
    document.getElementById("scheduleDeleteBtn")?.addEventListener("click", deleteSchedule);

    document.getElementById("scheduleModal")?.addEventListener("click", (event) => {
      if (event.target.id === "scheduleModal") {
        closeModalById("scheduleModal");
        resetForm();
      }
    });

    document.getElementById("scheduleReadModal")?.addEventListener("click", (event) => {
      if (event.target.id === "scheduleReadModal") {
        closeModalById("scheduleReadModal");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModalById("scheduleReadModal");
        closeModalById("scheduleModal");
      }
    });
  }

  function init() {
    setupReveal();
    bindEvents();
    if (isStaff) resetForm();
    loadSchedules();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();