(() => {
  const categoryMap = {
    notice: { label: "공지사항", cls: "tag-notice" },
    update: { label: "업데이트", cls: "tag-update" },
    schedule: { label: "일정", cls: "tag-schedule" },
    archive: { label: "아카이브", cls: "tag-archive" },
    important: { label: "중요", cls: "tag-important" },
  };

  const posts = [];
  let currentFilter = "all";
  let currentSearch = "";
  let currentPage = 1;
  let selectedPostId = null;
  const pageSize = 6;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizePost(post) {
    const normalized = { ...post };
    normalized.summary = normalized.summary || "";

    if (!Array.isArray(normalized.blocks) || !normalized.blocks.length) {
      normalized.blocks = normalized.body
        ? [{ type: "html", content: normalized.body }]
        : [];
    }

    return normalized;
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
        threshold: 0.16,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  function setupPointerGlow() {
    document.addEventListener("mousemove", (e) => {
      document
        .querySelectorAll(".pinned-notice, .post-card, .modal, .editor-block")
        .forEach((card) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty("--x", `${x}px`);
          card.style.setProperty("--y", `${y}px`);
        });
    });
  }

  async function loadPosts() {
    try {
      const response = await fetch("/api/isha/news/list/", {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const data = await response.json();

      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "게시글을 불러오지 못했습니다.");
      }

      posts.length = 0;
      (data.posts || []).forEach((post) => posts.push(normalizePost(post)));

      updateStats();
      updatePinned();
      renderList();
    } catch (error) {
      console.error(error);

      const listEl = document.getElementById("postList");
      const paginationEl = document.getElementById("pagination");

      if (listEl) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <div class="empty-text">게시글을 불러오지 못했습니다.</div>
          </div>
        `;
      }

      if (paginationEl) paginationEl.innerHTML = "";

      const pinnedCard = document.getElementById("pinnedCard");
      if (pinnedCard) pinnedCard.style.display = "none";

      updateStats();
    }
  }

  function isSameMonth(dateText) {
    const now = new Date();
    const normalized = String(dateText || "").replace(/\./g, "-");
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) return false;

    return (
      parsed.getFullYear() === now.getFullYear() &&
      parsed.getMonth() === now.getMonth()
    );
  }

  function updateStats() {
    const totalEl = document.getElementById("totalPosts");
    const monthlyEl = document.getElementById("monthlyPosts");
    const noticeEl = document.getElementById("noticeCnt");
    const daysEl = document.getElementById("daysSince");

    if (totalEl) totalEl.textContent = posts.length;

    if (monthlyEl) {
      monthlyEl.innerHTML = `${posts.filter((p) => isSameMonth(p.date)).length}<span>개</span>`;
    }

    if (noticeEl) {
      noticeEl.textContent = posts.filter(
        (p) => p.category === "notice" || p.category === "important"
      ).length;
    }

    if (daysEl) {
      const debut = new Date("2025-09-27");
      const diff = Math.floor((Date.now() - debut.getTime()) / 86400000);
      daysEl.innerHTML = `${diff}<span>일</span>`;
    }
  }

  function updatePinned() {
    const pinned = posts.find((p) => p.pinned);
    const titleEl = document.getElementById("pinnedTitle");
    const metaEl = document.getElementById("pinnedMeta");
    const pinnedCard = document.getElementById("pinnedCard");

    if (!pinnedCard) return;

    if (!pinned) {
      pinnedCard.style.display = "none";
      return;
    }

    pinnedCard.style.display = "";

    if (titleEl) titleEl.textContent = pinned.title;
    if (metaEl) {
      metaEl.textContent = `${pinned.author} · ${pinned.date} · 조회 ${pinned.views ?? 0}`;
    }

    pinnedCard.onclick = async () => {
      await increaseView(pinned.id);
      await loadPosts();
      const refreshed = posts.find((item) => Number(item.id) === Number(pinned.id)) || pinned;
      openPost(refreshed);
    };
  }

  function getFiltered() {
    return posts.filter((post) => {
      if (post.pinned) return false;

      const matchCat = currentFilter === "all" || post.category === currentFilter;
      const target = `${post.title} ${post.summary || ""}`.toLowerCase();
      const matchSearch = !currentSearch || target.includes(currentSearch);

      return matchCat && matchSearch;
    });
  }

  function renderPagination(totalItems) {
    const paginationEl = document.getElementById("pagination");
    if (!paginationEl) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    if (totalItems <= pageSize) {
      paginationEl.innerHTML = "";
      return;
    }

    let html = `
      <button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>
    `;

    for (let i = 1; i <= totalPages; i += 1) {
      html += `
        <button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">
          ${i}
        </button>
      `;
    }

    html += `
      <button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>
    `;

    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        currentPage = Number(btn.dataset.page || 1);
        renderList();
      });
    });
  }

  function renderList() {
    const listEl = document.getElementById("postList");
    if (!listEl) return;

    const items = getFiltered();
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = items.slice(startIndex, startIndex + pageSize);

    if (!items.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">게시글이 없습니다.</div>
        </div>
      `;
      renderPagination(0);
      return;
    }

    listEl.innerHTML = pageItems
      .map((post, index) => {
        const cat = categoryMap[post.category] || categoryMap.notice;
        const summaryTag = post.summary
          ? `<span class="post-tag tag-summary">추가 내용</span>`
          : "";

        return `
          <div class="post-card" data-post-id="${post.id}">
            <div class="post-num">${String(
              items.length - (startIndex + index)
            ).padStart(2, "0")}</div>

            <div class="post-body">
              <div class="post-tags">
                <span class="post-tag ${cat.cls}">${cat.label}</span>
                ${summaryTag}
              </div>

              <div class="post-title">
                ${escapeHtml(post.title)}
                ${post.isNew ? '<span class="badge-new">NEW</span>' : ""}
              </div>

              <div class="post-meta">
                <span class="post-meta-item">✍ ${escapeHtml(post.author || "관리자")}</span>
                ${post.summary ? `<span class="post-meta-item">📝 ${escapeHtml(post.summary)}</span>` : ""}
                <span class="post-meta-item">👁 ${escapeHtml(post.views ?? 0)}</span>
              </div>
            </div>

            <div class="post-right">
              <div class="post-date">${escapeHtml(post.date || "")}</div>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".post-card").forEach((card) => {
      card.addEventListener("click", async () => {
        const id = Number(card.dataset.postId);
        const post = posts.find((item) => Number(item.id) === id);
        if (!post) return;

        await increaseView(id);
        await loadPosts();
        const refreshed = posts.find((item) => Number(item.id) === id) || post;
        openPost(refreshed);
      });
    });

    renderPagination(items.length);
  }

  function renderPostBody(post) {
    return (post.blocks || [])
      .map((block) => {
        if (block.type === "text") {
          return `<p>${escapeHtml(block.content).replace(/\n/g, "<br>")}</p>`;
        }

        if (block.type === "image") {
          const src = escapeHtml(block.src || "");
          if (!src) return "";

          const caption = block.caption
            ? `<div class="news-image-caption">${escapeHtml(block.caption)}</div>`
            : "";

          return `
            <div class="news-image-block">
              <img src="${src}" alt="공지 이미지">
              ${caption}
            </div>
          `;
        }

        if (block.type === "html") {
          return block.content || "";
        }

        return "";
      })
      .join("");
  }

  function openPost(post) {
    selectedPostId = post.id;

    const cat = categoryMap[post.category] || categoryMap.notice;
    const tagsEl = document.getElementById("modalTags");
    const titleEl = document.getElementById("modalTitle");
    const metaEl = document.getElementById("modalMeta");
    const bodyEl = document.getElementById("modalBody");

    if (tagsEl) {
      tagsEl.innerHTML = `
        <span class="post-tag ${cat.cls}">${cat.label}</span>
        ${post.summary ? '<span class="post-tag tag-summary">추가 내용 포함</span>' : ""}
      `;
    }

    if (titleEl) titleEl.textContent = post.title;

    if (metaEl) {
      metaEl.innerHTML = `
        <span>✍ ${escapeHtml(post.author || "관리자")}</span>
        <span>📅 ${escapeHtml(post.date || "")}</span>
        <span>👁 ${escapeHtml(post.views ?? 0)}</span>
        ${post.summary ? `<span>📝 ${escapeHtml(post.summary)}</span>` : ""}
      `;
    }

    if (bodyEl) bodyEl.innerHTML = renderPostBody(post);

    openModal("readModal");
  }

  async function increaseView(postId) {
    try {
      await fetch(`/api/isha/news/${postId}/view/`, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      });
    } catch (error) {
      console.error(error);
    }
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("open");
    document.body.style.overflow = "";
  }

  function createBlockBase(type) {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-block";
    wrapper.dataset.blockType = type;
    return wrapper;
  }

  function getEditorBlocksContainer() {
    return document.getElementById("editorBlocks");
  }

  function createBlockHeader(kindLabel) {
    const header = document.createElement("div");
    header.className = "editor-block-header";
    header.innerHTML = `
      <span class="editor-block-kind">${kindLabel}</span>
      <div class="editor-block-actions">
        <button type="button" class="block-action-btn" data-action="up">위로</button>
        <button type="button" class="block-action-btn" data-action="down">아래로</button>
        <button type="button" class="block-action-btn block-remove-btn" data-action="remove">삭제</button>
      </div>
    `;
    return header;
  }

  function attachBlockActions(blockEl) {
    blockEl.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const container = getEditorBlocksContainer();
        if (!container) return;

        if (action === "remove") {
          blockEl.remove();
        } else if (action === "up" && blockEl.previousElementSibling) {
          container.insertBefore(blockEl, blockEl.previousElementSibling);
        } else if (action === "down" && blockEl.nextElementSibling) {
          container.insertBefore(blockEl.nextElementSibling, blockEl);
        }

        refreshBlockButtons();
        renderEditorEmptyState();
      });
    });
  }

  function refreshBlockButtons() {
    const blocks = [...document.querySelectorAll(".editor-block")];
    blocks.forEach((block, index) => {
      const up = block.querySelector('[data-action="up"]');
      const down = block.querySelector('[data-action="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === blocks.length - 1;
    });
  }

  function renderEditorEmptyState() {
    const container = getEditorBlocksContainer();
    if (!container) return;

    const exists = container.querySelector(".editor-block");
    let empty = container.querySelector(".editor-empty");

    if (!exists) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "editor-empty";
        empty.textContent = "텍스트 블록이나 이미지 블록을 추가해서 공지를 구성해보세요.";
        container.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  function addTextBlock(value = "") {
    const container = getEditorBlocksContainer();
    if (!container) return;

    const block = createBlockBase("text");
    const header = createBlockHeader("텍스트 블록");

    const textarea = document.createElement("textarea");
    textarea.className = "form-textarea block-text";
    textarea.placeholder = "내용을 입력하세요";
    textarea.value = value;

    block.appendChild(header);
    block.appendChild(textarea);
    container.appendChild(block);

    attachBlockActions(block);
    refreshBlockButtons();
    renderEditorEmptyState();
  }

  function addImageBlock(src = "", caption = "") {
    const container = getEditorBlocksContainer();
    if (!container) return;

    const block = createBlockBase("image");
    const header = createBlockHeader("이미지 블록");
    const controls = document.createElement("div");
    controls.className = "block-image-controls";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "block-file-input";

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.className = "form-input block-image-caption";
    captionInput.placeholder = "이미지 설명 또는 추가 내용을 입력하세요";
    captionInput.value = caption;

    const preview = document.createElement("div");
    preview.className = "block-image-preview";

    const previewImg = document.createElement("img");
    preview.appendChild(previewImg);

    if (src) {
      block.dataset.imageSrc = src;
      previewImg.src = src;
      preview.classList.add("has-image");
    }

    fileInput.addEventListener("change", (event) => {
      const [file] = event.target.files || [];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = String(e.target?.result || "");
        block.dataset.imageSrc = result;
        previewImg.src = result;
        preview.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    });

    controls.appendChild(fileInput);
    controls.appendChild(captionInput);
    controls.appendChild(preview);

    block.appendChild(header);
    block.appendChild(controls);
    container.appendChild(block);

    attachBlockActions(block);
    refreshBlockButtons();
    renderEditorEmptyState();
  }

  function collectBlocksForSubmit(formData) {
    const blocks = [];

    document.querySelectorAll(".editor-block").forEach((blockEl, index) => {
      const type = blockEl.dataset.blockType;

      if (type === "text") {
        const value = blockEl.querySelector(".block-text")?.value.trim() || "";
        if (value) {
          blocks.push({ type: "text", content: value });
        }
      }

      if (type === "image") {
        const fileInput = blockEl.querySelector(".block-file-input");
        const file = fileInput?.files?.[0];
        const caption = blockEl.querySelector(".block-image-caption")?.value.trim() || "";

        if (file) {
          const imageKey = `image_${index}`;
          formData.append(imageKey, file);
          blocks.push({
            type: "image",
            image_key: imageKey,
            caption,
          });
        }
      }
    });

    return blocks;
  }

  function resetEditor() {
    const titleEl = document.getElementById("newTitle");
    const summaryEl = document.getElementById("newSummary");
    const categoryEl = document.getElementById("newCategory");
    const pinnedEl = document.getElementById("newPinned");
    const editingIdEl = document.getElementById("editingPostId");
    const container = getEditorBlocksContainer();
    const modalTitleEl = document.getElementById("writeModalTitleText");

    if (titleEl) titleEl.value = "";
    if (summaryEl) summaryEl.value = "";
    if (categoryEl) categoryEl.value = "notice";
    if (pinnedEl) pinnedEl.value = "false";
    if (editingIdEl) editingIdEl.value = "";
    if (modalTitleEl) modalTitleEl.textContent = "새 게시글 작성";
    if (container) container.innerHTML = "";

    addTextBlock("");
  }

  function openEditPost(post) {
    const titleEl = document.getElementById("newTitle");
    const summaryEl = document.getElementById("newSummary");
    const categoryEl = document.getElementById("newCategory");
    const pinnedEl = document.getElementById("newPinned");
    const editingIdEl = document.getElementById("editingPostId");
    const container = getEditorBlocksContainer();
    const modalTitleEl = document.getElementById("writeModalTitleText");

    if (!titleEl || !summaryEl || !categoryEl || !pinnedEl || !editingIdEl || !container) return;

    titleEl.value = post.title || "";
    summaryEl.value = post.summary || "";
    categoryEl.value = post.category || "notice";
    pinnedEl.value = post.pinned ? "true" : "false";
    editingIdEl.value = post.id;

    if (modalTitleEl) modalTitleEl.textContent = "게시글 수정";

    container.innerHTML = "";

    (post.blocks || []).forEach((block) => {
      if (block.type === "text") {
        addTextBlock(block.content || "");
      } else if (block.type === "image") {
        addImageBlock(block.src || "", block.caption || "");
      }
    });

    renderEditorEmptyState();
    closeModal("readModal");
    openModal("writeModal");
  }

  async function submitPost() {
    const titleEl = document.getElementById("newTitle");
    const summaryEl = document.getElementById("newSummary");
    const categoryEl = document.getElementById("newCategory");
    const pinnedEl = document.getElementById("newPinned");
    const editingIdEl = document.getElementById("editingPostId");

    const title = titleEl?.value.trim() || "";
    const summary = summaryEl?.value.trim() || "";
    const category = categoryEl?.value || "notice";
    const pinned = pinnedEl?.value === "true";
    const editingId = editingIdEl?.value || "";

    if (!title) {
      alert("게시글 제목을 입력해주세요.");
      return;
    }

    const formData = new FormData();
    const blocks = collectBlocksForSubmit(formData);

    if (!blocks.length) {
      alert("본문에 텍스트나 이미지를 하나 이상 추가해주세요.");
      return;
    }

    formData.append("title", title);
    formData.append("summary", summary);
    formData.append("category", category);
    formData.append("is_pinned", String(pinned));
    formData.append("blocks", JSON.stringify(blocks));

    const url = editingId
      ? `/api/isha/news/${editingId}/update/`
      : "/api/isha/news/create/";

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          "X-CSRFToken": getCSRFToken(),
        },
      });

      const data = await response.json();

      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "공지 저장에 실패했습니다.");
      }

      closeModal("writeModal");
      resetEditor();
      currentPage = 1;
      await loadPosts();
      alert(editingId ? "수정 완료!" : "등록 완료!");
    } catch (error) {
      console.error(error);
      alert(error.message || "공지 저장 중 오류가 발생했습니다.");
    }
  }

  async function deletePost() {
    if (!selectedPostId) return;
    if (!confirm("이 게시글을 삭제할까요?")) return;

    try {
      const response = await fetch(`/api/isha/news/${selectedPostId}/delete/`, {
        method: "POST",
        headers: {
          "X-CSRFToken": getCSRFToken(),
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const data = await response.json();

      if (!response.ok || data.result !== "success") {
        throw new Error(data.message || "게시글 삭제에 실패했습니다.");
      }

      closeModal("readModal");
      selectedPostId = null;
      await loadPosts();
      alert("삭제 완료!");
    } catch (error) {
      console.error(error);
      alert(error.message || "게시글 삭제 중 오류가 발생했습니다.");
    }
  }

  function getCSRFToken() {
    return (
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1] || ""
    );
  }

  function bindEvents() {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter || "all";
        currentPage = 1;
        renderList();
      });
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        currentSearch = String(event.target.value || "").toLowerCase();
        currentPage = 1;
        renderList();
      });
    }

    document.getElementById("readModalClose")?.addEventListener("click", () => closeModal("readModal"));

    document.getElementById("writeModalClose")?.addEventListener("click", () => {
      closeModal("writeModal");
      resetEditor();
    });

    document.getElementById("readModal")?.addEventListener("click", (event) => {
      if (event.target.id === "readModal") closeModal("readModal");
    });

    document.getElementById("writeModal")?.addEventListener("click", (event) => {
      if (event.target.id === "writeModal") {
        closeModal("writeModal");
        resetEditor();
      }
    });

    document.getElementById("adminFab")?.addEventListener("click", () => {
      resetEditor();
      openModal("writeModal");
    });

    document.getElementById("submitPostBtn")?.addEventListener("click", submitPost);
    document.getElementById("addTextBlockBtn")?.addEventListener("click", () => addTextBlock(""));
    document.getElementById("addImageBlockBtn")?.addEventListener("click", () => addImageBlock("", ""));
    document.getElementById("newsDeleteBtn")?.addEventListener("click", deletePost);

    document.getElementById("newsEditBtn")?.addEventListener("click", () => {
      const post = posts.find((item) => Number(item.id) === Number(selectedPostId));
      if (!post) return;
      openEditPost(post);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal("readModal");
        closeModal("writeModal");
      }
    });
  }

  function init() {
    setupReveal();
    setupPointerGlow();
    bindEvents();
    renderEditorEmptyState();
    loadPosts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();