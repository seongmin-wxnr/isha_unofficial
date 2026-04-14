function navigateTo(url) {
    document.body.classList.add('fade-out');
    setTimeout(() => {
      window.location.href = url;
    }, 400);
  }

  // 🔥 모바일 메뉴 토글
  document.addEventListener("DOMContentLoaded", function () {
    const navToggle = document.getElementById("navToggle");
    const mobileNav = document.getElementById("mobileNav");

    if (!navToggle || !mobileNav) return;

    navToggle.addEventListener("click", function () {
      navToggle.classList.toggle("active");
      mobileNav.classList.toggle("show");
    });
    
  });

document.addEventListener("click", function (e) {
  if (!mobileNav.contains(e.target) && !navToggle.contains(e.target)) {
    mobileNav.classList.remove("show");
    navToggle.classList.remove("active");
  }
});

