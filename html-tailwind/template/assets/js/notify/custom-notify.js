

document.addEventListener("DOMContentLoaded", function () {
  function showToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
      // Show the toast
      toast.classList.remove("hide", "fade");
      toast.classList.add("show");

      // Hide after 3 seconds
      setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("hide", "fade");
      }, 3000);
    }
  }

  // Mapping buttons to toast IDs
  const toastButtons = {
    liveToastBtn6: "liveToast6",
    liveToastBtn5: "liveToast5",
    liveToastBtn4: "liveToast4",
    liveToastBtn: "liveToast",
    liveToastBtn1: "liveToast1",
    liveToastBtn2: "liveToast2",
    liveToastBtn3: "liveToast3",
  };

  // Attach click event to each button
  Object.entries(toastButtons).forEach(([btnId, toastId]) => {
    const button = document.getElementById(btnId);
    if (button) {
      button.addEventListener("click", () => showToast(toastId));
    }
  });

  // Close button functionality
  document.querySelectorAll(".btn-close").forEach((btn) => {
    btn.addEventListener("click", function () {
      const toast = this.closest(".toast");
      if (toast) {
        toast.classList.remove("show");
        toast.classList.add("hide", "fade");
      }
    });
  });
});