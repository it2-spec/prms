document.addEventListener("click", (event) => {
  if (event.target.matches('[data-bs-toggle="modal"]')) {
    const targetSelector = event.target.getAttribute("data-bs-target");
    const modal = document.querySelector(targetSelector);

    if (modal) {
      if (modal.classList.contains("show")) {
        modal.classList.remove("show");
        document.body.classList.remove("modal-open");
        document.body.style.overflow = "";
      } else {
        modal.classList.add("show");
        document.body.classList.add("modal-open");
        document.body.style.overflow = "hidden";
      }
    }
  }
  if (event.target.matches('[data-bs-dismiss="modal"]')) {
    const modal = event.target.closest(".modal");
    if (modal) {
      modal.classList.remove("show");
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    }
  }
  if (
    event.target.classList.contains("modal") &&
    event.target.classList.contains("show")
  ) {
    event.target.classList.remove("show");
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
  }
});
