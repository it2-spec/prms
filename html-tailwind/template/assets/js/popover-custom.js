document.addEventListener("DOMContentLoaded", () => {
  const popoverButtons = document.querySelectorAll('[data-bs-toggle="popover"]');
  popoverButtons.forEach(button => {
    button.addEventListener("click", function (event) {
      if (button.popoverElement && button.popoverElement.classList.contains("show")) {
        closePopover(button);
        return;
      }
      closeAllPopovers();
      const popover = document.createElement("div");
      popover.classList.add("popover");
      popover.innerHTML = `
        <div class="popover-arrow"></div>
        <div class="popover-header">${event.target.getAttribute("title")}</div>
        <div class="popover-body">${event.target.getAttribute("data-bs-content")}</div>
      `;
      document.body.appendChild(popover);
      const buttonRect = event.target.getBoundingClientRect();
      const arrowSize = 10;
      popover.style.left = `${buttonRect.left + window.scrollX}px`;
      popover.style.top = `${buttonRect.top + buttonRect.height + window.scrollY + arrowSize}px`;
      popover.classList.add("show");
      button.popoverElement = popover;
    });
  });
  function closeAllPopovers() {
    const popovers = document.querySelectorAll(".popover");
    popovers.forEach(popover => {
      popover.classList.remove("show");
      popover.remove();
    });
    popoverButtons.forEach(button => {
      if (button.popoverElement) {
        button.popoverElement = null;
      }
    });
  }
  function closePopover(button) {
    if (button.popoverElement) {
      button.popoverElement.classList.remove("show");
      button.popoverElement.remove();
      button.popoverElement = null;
    }
  }
  document.addEventListener("click", event => {
    if (!event.target.closest('[data-bs-toggle="popover"]')) {
      closeAllPopovers();
    }
  });
});
