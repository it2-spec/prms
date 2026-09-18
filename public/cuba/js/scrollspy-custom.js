document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".scroll-section");
  const navLinks = document.querySelectorAll(".nav-link");
  const dropdownLinks = document.querySelectorAll(".dropdown-link");
  const dropdownBtn = document.getElementById("dropdown-btn");
  const dropdownMenu = document.getElementById("dropdown-menu");
  const scrollContainer = document.querySelector(".scroll-container");

  // ScrollSpy with IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          // Update Navbar Links
          navLinks.forEach((link) => link.classList.remove("active"));
          document
            .querySelector(`.nav-link[href="#${id}"]`)
            ?.classList.add("active");

          // Update Dropdown Links
          dropdownLinks.forEach((link) => link.classList.remove("active"));
          document
            .querySelector(`.dropdown-link[href="#${id}"]`)
            ?.classList.add("active");
        }
      });
    },
    {
      root: scrollContainer, // Observe only inside the scroll-container
      threshold: 0.6, // 60% of the section must be visible to activate
    }
  );

  sections.forEach((section) => observer.observe(section));

  // Dropdown Toggle
  dropdownBtn.addEventListener("click", () => {
    dropdownMenu.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (event) => {
    if (
      !dropdownBtn.contains(event.target) &&
      !dropdownMenu.contains(event.target)
    ) {
      dropdownMenu.classList.add("hidden");
    }
  });

  // Smooth Scrolling for Navbar Links
  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        scrollContainer.scrollTo({
          top: targetSection.offsetTop,
          behavior: "smooth",
        });
      }
    });
  });

  // Smooth Scrolling for Dropdown Links
  dropdownLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        scrollContainer.scrollTo({
          top: targetSection.offsetTop,
          behavior: "smooth",
        });
        dropdownMenu.classList.add("hidden"); // Close dropdown after click
      }
    });
  });
});
