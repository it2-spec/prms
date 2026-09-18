// Form Validation JS

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const forms = document.querySelectorAll(".needs-validation");

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add("was-validated");
    });
  });
});

// Form Validation JS
(function () {
  "use strict";

  const form = document.querySelector(".needs-validation");
  const inputs = form.querySelectorAll(".form-control");

  // Form submit event listener
  form.addEventListener("submit", (event) => {
    event.preventDefault(); // Prevent form submission
    event.stopPropagation(); // Stop the form from propagating further

    let isValid = true;

    // Add the "was-validated" class to show feedback messages after submission attempt
    form.classList.add("was-validated");

    // Loop through all form controls (inputs, selects, textareas)
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.checkValidity()) {
        toggleValidationMessage(field, false); // Show error message
        isValid = false;
      } else {
        toggleValidationMessage(field, true); // Show success message
      }
    });

    if (isValid) {
      alert("Form submitted successfully!"); // Replace with actual form submission logic
      form.reset(); // Reset the form after submission (optional)
    }
  });

  // Toggle validation message visibility based on validity
  function toggleValidationMessage(field, isValid) {
    const errorMessage = field.nextElementSibling;

    if (errorMessage) {
      errorMessage.style.display = isValid ? "none" : "block";
    }
  }
})();
