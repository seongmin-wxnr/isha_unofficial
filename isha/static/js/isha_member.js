document.addEventListener("DOMContentLoaded", () => {
  const revealItems = document.querySelectorAll(".reveal");

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

  const navItems = document.querySelectorAll(".member-nav-item");
  const contents = document.querySelectorAll(".member-content");

  navItems.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-target");

      navItems.forEach((item) => item.classList.remove("is-active"));
      contents.forEach((content) => content.classList.remove("is-active"));

      button.classList.add("is-active");

      const activeContent = document.getElementById(target);
      if (activeContent) {
        activeContent.classList.add("is-active");
      }
    });
  });
});