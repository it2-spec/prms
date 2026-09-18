const accordionItems = document.querySelectorAll(".accordion-item");

accordionItems.forEach((item) => {
  const header = item.querySelector(".accordion-header");
  const button = header.querySelector(".accordion-button");
  const collapse = item.querySelector(".accordion-collapse");

  header.addEventListener("click", () => {
    const isOpen = collapse.classList.contains("show");
    document
      .querySelectorAll(".accordion-collapse.show")
      .forEach((openCollapse) => {
        openCollapse.classList.remove("show");
        openCollapse.style.maxHeight = null;
        openCollapse.previousElementSibling
          .querySelector(".accordion-button")
          .classList.add("collapsed");
      });

    if (!isOpen) {
      collapse.classList.add("show");
      collapse.style.maxHeight = collapse.scrollHeight + "px";
      button.classList.remove("collapsed");
    } else {
      collapse.classList.remove("show");
      collapse.style.maxHeight = null;
      button.classList.add("collapsed");
    }
  });
});

document.querySelectorAll("[aria-controls]").forEach((button) => {
  button.addEventListener("click", function () {
    const targetIds = button.getAttribute("aria-controls").split(" ");
    targetIds.forEach((id) => {
      const targetElement = document.getElementById(id);
      if (targetElement) {
        if (targetElement.closest(".multiple-collapse")) {
          const isOpen = targetElement.classList.contains("show");
          if (isOpen) {
            targetElement.classList.remove("show");
            targetElement.style.maxHeight = null;
          } else {
            targetElement.classList.add("show");
            targetElement.style.maxHeight = targetElement.scrollHeight + "px";
          }
        } else {
          console.error(
            `Element with ID "${id}" is not inside a 'multiple-collapse'`
          );
        }
      } else {
        console.error(`Element with ID "${id}" not found.`);
      }
    });
  });
});
