/*=====================
    input valid & invalid Js
==========================*/

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".needs-validation");
  const inputsAndSelects = form.querySelectorAll(".form-control, .form-select");

  const validateInput = (element) => {
    const feedbackValid =
      element.parentElement.querySelector(".valid-feedback");
    const feedbackInvalid =
      element.parentElement.querySelector(".invalid-feedback");
    if (element.checkValidity()) {
      element.classList.add("valid");
      element.classList.remove("invalid");
      if (feedbackValid) feedbackValid.style.display = "block";
      if (feedbackInvalid) feedbackInvalid.style.display = "none";
    } else {
      element.classList.add("invalid");
      element.classList.remove("valid");
      if (feedbackValid) feedbackValid.style.display = "none";
      if (feedbackInvalid) feedbackInvalid.style.display = "block";
    }
  };
  form.addEventListener("submit", (event) => {
    form.classList.add("was-validated");
    let isValid = true;
    inputsAndSelects.forEach((element) => {
      validateInput(element);
      if (!element.checkValidity()) isValid = false;
    });

    if (!isValid) {
      event.preventDefault();
    }
  });
  inputsAndSelects.forEach((element) => {
    element.addEventListener("input", () => validateInput(element));
    element.addEventListener("change", () => validateInput(element));
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".needs-validation");
  const inputsAndSelects = form.querySelectorAll(".form-control, .form-select");

  const validateInput = (element) => {
    const feedbackValid = element.parentElement.querySelector(".valid-tooltip");
    const feedbackInvalid =
      element.parentElement.querySelector(".invalid-tooltip");
    if (element.checkValidity()) {
      element.classList.add("valid");
      element.classList.remove("invalid");
      if (feedbackValid) feedbackValid.style.display = "block";
      if (feedbackInvalid) feedbackInvalid.style.display = "none";
    } else {
      element.classList.add("invalid");
      element.classList.remove("valid");
      if (feedbackValid) feedbackValid.style.display = "none";
      if (feedbackInvalid) feedbackInvalid.style.display = "block";
    }
  };
  form.addEventListener("submit", (event) => {
    form.classList.add("was-validated");
    let isValid = true;
    inputsAndSelects.forEach((element) => {
      validateInput(element);
      if (!element.checkValidity()) isValid = false;
    });

    if (!isValid) {
      event.preventDefault();
    }
  });
  inputsAndSelects.forEach((element) => {
    element.addEventListener("input", () => validateInput(element));
    element.addEventListener("change", () => validateInput(element));
  });
});
