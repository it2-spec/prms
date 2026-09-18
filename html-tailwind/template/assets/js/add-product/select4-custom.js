(function () {
  ("use strict");
  // =============== Editor ============================
  // The DOM element you wish to replace with Tagify
  var input = document.querySelector("input[name=basic-tags]");

  // initialize Tagify on the above input node reference
  new Tagify(input);

  // The DOM element you wish to replace with Tagify
  var input = document.querySelector("input[name=basic-tags1]");

  // initialize Tagify on the above input node reference
  new Tagify(input);
})();

// ========================= Common Select Dropdown ==========================

document.addEventListener("DOMContentLoaded", () => {
  const optionVariation = document.getElementById("option-variation");
  const optionValue = document.getElementById("option-value");
  optionVariation.value = "color"; // Set the default value
  configureDropDownLists(optionVariation, optionValue);
});
function configureDropDownLists(optionVariation, optionValue) {
  const options = {
    color: ["Red", "White", "Black", "Gray", "Green"],
    size: ["Small", "Extra Small", "Medium", "Large", "Extra Large"],
    material: ["Cotton", "Denim", "Fabric"],
    style: ["Festive", "Fusion", "Daily"],
  };

  const selectedOptions = options[optionVariation.value] || [];
  optionValue.options.length = 0;

  selectedOptions.forEach(option => createOption(optionValue, option, option));
}

function createOption(ddl, text, value) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.text = text;
  ddl.add(opt);
}

// ============== Previous - next button ================
function handleNextButtonClick(nextTabId) {
  const nextTabNumber = getTabNumber(nextTabId);

  // Hide all tab panels
  document.querySelectorAll(".tab-pan").forEach(pane => {
    pane.classList.remove("show", "active");
  });

  // Remove active from all sidebar links
  document.querySelectorAll(".tab-link").forEach(link => {
    link.classList.remove("active");
  });

  // Show the next tab panel
  const nextTab = document.querySelector(`.tab-pan[data-tabcontent="${nextTabNumber}"]`);
  if (nextTab) {
    nextTab.classList.add("show", "active");
  }

  // Activate the corresponding sidebar link
  const nextSidebarLink = document.querySelector(`.tab-link[data-tabfilter="${nextTabNumber}"]`);
  if (nextSidebarLink) {
    nextSidebarLink.classList.add("active");
  }
}

// Map tab IDs to their data-tabcontent number
function getTabNumber(tabId) {
  const map = {
    "gallery-product-tab": 2,
    "category-product-tab": 3,
    "pricings-tab": 4,
    "advance-product-tab": 5,
    "detail-product-tab": 1,
    "seo-option-tab": 2,
    "manifest-option-tab": 1,
    "dropping-option-tab": 3,
    "variation-option-tab": 4,
    "publish-option-tab": 5,
  };
  return map[tabId] || 1; // default 1 if not found
}

// ============ Toast =============
function handleSubmitButtonClick() {
  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: toast => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
  });
  Toast.fire({
    icon: "success",
    title: "Successfully",
  });
}
