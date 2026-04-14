document.addEventListener("DOMContentLoaded", () => {
  if (!window.IS_AUTH) return;

  const postList    = document.getElementById("postList");
  const pagination  = document.getElementById("pagination");
  const searchInput = document.getElementById("searchInput");
  const writeFab    = document.getElementById("writeFab");

  const writeModal      = document.getElementById("writeModal");
  const writeModalClose = document.getElementById("writeModalClose");
  const submitPostBtn   = document.getElementById("submitPostBtn");
  const newTitle        = document.getElementById("newTitle");
  const newContent      = document.getElementById("newContent");

  const readModal      = document.getElementById("readModal");
  const readModalClose = document.getElementById("readModalClose");
  const modalTitle     = document.getElementById("modalTitle");
  const modalTags      = document.getElementById("modalTags");
  const modalMeta      = document.getElementById("modalMeta");
  const modalBody      = document.getElementById("modalBody");
  const replySection   = document.getElementById("replySection");
  const replyContent   = document.getElementById("replyContent");
  const deletePostBtn  = document.getElementById("deletePostBtn");

  const replyInput     = document.getElementById("replyInput");
  const submitReplyBtn = document.getElementById("submitReplyBtn");

  const revealItems = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealItems.forEach(item => observer.observe(item));

  let allPosts     = [];
  let filtered     = [];
  let currentPage  = 1;
  let currentStatus = "all";
  let currentPostId = null;
  const PER_PAGE   = 10;

  const STATUS_CLASS = { pending: "status-pending", answered: "status-answered", closed: "status-closed" };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function loadPosts() {
    try {
      const res  = await fetch("/api/isha/contact/list/");
      const data = await res.json();
      if (data.result !== "success") throw new Error(data.message);
      allPosts = data.items || [];
      applyFilter();
    } catch (e) {
      postList.innerHTML = `<div class="contact-empty"><p>문의 목록을 불러오지 못했습니다.</p></div>`;
    }
  }

  function applyFilter() {
    const q = (searchInput.value || "").trim().toLowerCase();
    filtered = allPosts.filter(p => {
      const matchStatus = currentStatus === "all" || p.status === currentStatus;
      const matchSearch = !q || p.title.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
    currentPage = 1;
    renderList();
    renderPagination();
  }

  function renderList() {
    if (!filtered.length) {
      postList.innerHTML = `<div class="contact-empty"><p>문의사항이 없습니다.</p></div>`;
      return;
    }
    const start = (currentPage - 1) * PER_PAGE;
    const items = filtered.slice(start, start + PER_PAGE);

    postList.innerHTML = items.map(p => `
      <div class="post-item${p.is_mine ? " is-mine" : ""}" data-id="${p.id}" style="cursor:pointer">
        <div class="post-item-left">
          <span class="status-badge ${STATUS_CLASS[p.status] || ""}">${escapeHtml(p.status_display)}</span>
          <span class="post-title">${escapeHtml(p.title)}</span>
          ${p.has_reply ? '<span class="reply-indicator">💬</span>' : ""}
        </div>
        <div class="post-item-right">
          <span class="post-meta">${escapeHtml(p.created_at)}</span>
        </div>
      </div>
    `).join("");

    postList.querySelectorAll(".post-item").forEach(el => {
      el.addEventListener("click", () => openDetail(parseInt(el.dataset.id)));
    });
  }

  function renderPagination() {
    const total = Math.ceil(filtered.length / PER_PAGE);
    if (total <= 1) { pagination.innerHTML = ""; return; }

    const nav = document.createElement("div");
    nav.className = "pagination";

    const prev = document.createElement("button");
    prev.className = "page-btn" + (currentPage === 1 ? " disabled" : "");
    prev.textContent = "←";
    prev.disabled = currentPage === 1;
    prev.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderList(); renderPagination(); } });
    nav.appendChild(prev);

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `${currentPage} / ${total}`;
    nav.appendChild(label);

    const next = document.createElement("button");
    next.className = "page-btn" + (currentPage === total ? " disabled" : "");
    next.textContent = "→";
    next.disabled = currentPage === total;
    next.addEventListener("click", () => { if (currentPage < total) { currentPage++; renderList(); renderPagination(); } });
    nav.appendChild(next);

    pagination.innerHTML = "";
    pagination.appendChild(nav);
  }

  async function openDetail(id) {
    currentPostId = id;
    try {
      const res  = await fetch(`/api/isha/contact/${id}/`);
      const data = await res.json();
      if (data.result !== "success") { alert(data.message); return; }

      const p = data.item;

      modalTags.innerHTML = `<span class="status-badge ${STATUS_CLASS[p.status] || ""}">${escapeHtml(p.status_display)}</span>`;
      modalTitle.textContent = p.title;
      modalMeta.innerHTML = `<span>${escapeHtml(p.author)}</span><span>·</span><span>${escapeHtml(p.created_at)}</span><span>·</span><span>조회 ${p.views}</span>`;
      modalBody.innerHTML = `<p style="white-space:pre-wrap;line-height:1.85">${escapeHtml(p.content)}</p>`;

      if (p.admin_reply) {
        replyContent.textContent = p.admin_reply;
        replySection.style.display = "block";
      } else {
        replySection.style.display = "none";
      }

      if (replyInput) replyInput.value = p.admin_reply || "";

      deletePostBtn.style.display = (p.is_mine || window.ISHA_IS_STAFF) ? "inline-flex" : "none";

      readModal.classList.add("open");
      document.body.style.overflow = "hidden";
    } catch (e) {
      alert("문의 내용을 불러오지 못했습니다.");
    }
  }

  function closeReadModal() {
    readModal.classList.remove("open");
    document.body.style.overflow = "";
    currentPostId = null;
  }

  function openWriteModal() {
    newTitle.value = "";
    newContent.value = "";
    writeModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeWriteModal() {
    writeModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (writeFab) writeFab.addEventListener("click", openWriteModal);
  if (writeModalClose) writeModalClose.addEventListener("click", closeWriteModal);
  if (readModalClose) readModalClose.addEventListener("click", closeReadModal);

  readModal?.addEventListener("click", e => { if (e.target === readModal) closeReadModal(); });
  writeModal?.addEventListener("click", e => { if (e.target === writeModal) closeWriteModal(); });

  submitPostBtn?.addEventListener("click", async () => {
    const title   = (newTitle.value || "").trim();
    const content = (newContent.value || "").trim();
    if (!title)   { alert("제목을 입력해주세요."); return; }
    if (!content) { alert("내용을 입력해주세요."); return; }

    try {
      const res  = await fetch("/api/isha/contact/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (data.result !== "success") { alert(data.message); return; }
      closeWriteModal();
      await loadPosts();
    } catch (e) {
      alert("문의 제출에 실패했습니다.");
    }
  });

  deletePostBtn?.addEventListener("click", async () => {
    if (!currentPostId || !confirm("문의를 삭제할까요?")) return;
    try {
      const res  = await fetch(`/api/isha/contact/${currentPostId}/delete/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": getCsrf() },
      });
      const data = await res.json();
      if (data.result !== "success") { alert(data.message); return; }
      closeReadModal();
      await loadPosts();
    } catch (e) {
      alert("삭제에 실패했습니다.");
    }
  });

  submitReplyBtn?.addEventListener("click", async () => {
    const reply = (replyInput.value || "").trim();
    if (!reply || !currentPostId) return;
    try {
      const res  = await fetch(`/api/isha/contact/${currentPostId}/reply/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrf() },
        body: JSON.stringify({ reply }),
      });
      const data = await res.json();
      if (data.result !== "success") { alert(data.message); return; }
      closeReadModal();
      await loadPosts();
    } catch (e) {
      alert("답변 저장에 실패했습니다.");
    }
  });

  document.querySelectorAll(".filter-btn[data-status]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn[data-status]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatus = btn.dataset.status;
      applyFilter();
    });
  });

  searchInput?.addEventListener("input", applyFilter);

  function getCsrf() {
    return document.cookie.split(";").find(c => c.trim().startsWith("csrftoken="))?.split("=")[1] || "";
  }

  loadPosts();
});