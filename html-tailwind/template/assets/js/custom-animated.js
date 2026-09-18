// document.addEventListener("DOMContentLoaded", function () {
//   const entranceSelect = document.getElementById("entrance");
//   const exitSelect = document.getElementById("exit");
//   const modal = document.getElementById("myModal");
//   const launchBtn = document.querySelector("[data-bs-toggle='modal']");
//   const closeBtn = modal.querySelector(".btn-close");
//   function addBackdrop() {
//     let backdrop = document.createElement("div");
//     backdrop.className = "modal-backdrop fade show";
//     document.body.appendChild(backdrop);
//   }
//   function removeBackdrop() {
//     const backdrop = document.querySelector(".modal-backdrop");
//     if (backdrop) {
//       backdrop.classList.remove("show");
//       setTimeout(() => backdrop.remove(), 200);
//     }
//   }
//   launchBtn.addEventListener("click", function () {
//     const entranceAnimation = entranceSelect.value;

//     modal.classList.add("animate__animated", `animate__${entranceAnimation}`);
//     setTimeout(() => {
//       modal.classList.add("show");
//       modal.style.display = "block";
//       addBackdrop();
//     }, 200);

//     modal.addEventListener(
//       "animationend",
//       function () {
//         modal.classList.remove(`animate__${entranceAnimation}`);
//       },
//       { once: true }
//     );
//   });
//   closeBtn.addEventListener("click", function () {
//     const exitAnimation = exitSelect.value;

//     modal.classList.add("animate__animated", `animate__${exitAnimation}`);

//     modal.addEventListener(
//       "animationend",
//       function () {
//         modal.classList.remove(`animate__${exitAnimation}`);
//         modal.classList.remove("show");
//         modal.style.display = "none";
//         removeBackdrop();
//       },
//       { once: true }
//     );
//   });
// });

document.addEventListener("DOMContentLoaded", function () {
  const entranceSelect = document.getElementById("entrance");
  const exitSelect = document.getElementById("exit");
  const modal = document.getElementById("myModal");
  const launchBtn = document.querySelector("[data-bs-toggle='modal']");
  const closeBtn = modal.querySelector(".btn-close");

  // Function to create and show backdrop inside body
  function addBackdrop() {
    let backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop fade show";

    // Append backdrop inside <body>
    document.body.appendChild(backdrop);
  }

  // Function to remove backdrop
  function removeBackdrop() {
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.classList.remove("show");
      setTimeout(() => backdrop.remove(), 200); // Allow fade-out effect
    }
  }

  // Open modal with entrance animation
  launchBtn.addEventListener("click", function () {
    const entranceAnimation = entranceSelect.value;

    modal.classList.add("animate__animated", `animate__${entranceAnimation}`);

    // Delay to ensure 's 'show' class applies correctly
    setTimeout(() => {
      modal.classList.add("show");
      modal.style.display = "block";
      addBackdrop(); // Add backdrop inside <body>
    }, 200);

    modal.addEventListener(
      "animationend",
      function () {
        modal.classList.remove(`animate__${entranceAnimation}`);
      },
      { once: true }
    );
  });

  // Close modal with exit animation
  closeBtn.addEventListener("click", function () {
    const exitAnimation = exitSelect.value;

    modal.classList.add("animate__animated", `animate__${exitAnimation}`);

    modal.addEventListener(
      "animationend",
      function () {
        modal.classList.remove(`animate__${exitAnimation}`);
        modal.classList.remove("show");
        modal.style.display = "none"; // Hide modal properly after animation
        removeBackdrop(); // Remove backdrop when modal closes
      },
      { once: true }
    );
  });
});
