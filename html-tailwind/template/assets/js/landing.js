// Landing JS

(function ($) {
  "use strict";
  // localstorage all setting

  $(".page-wrapper").attr("class", localStorage.getItem("page-wrapper"));

  // dubai layout
  $(".default-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-wrapper");
  });

  $(".los-view").click(function () {
    localStorage.setItem("page-wrapper", "horizontal-wrapper material-type");
  });

  $(".paris-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-wrapper dark-sidebar");
  });

  $(".tokyo-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-sidebar");
  });

  $(".moscow-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-sidebar compact-small");
  });

  $(".singapore-view").click(function () {
    localStorage.setItem("page-wrapper", "horizontal-wrapper enterprice-type");
  });

  $(".newyork-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-wrapper box-layout");
  });

  $(".barcelona-view").click(function () {
    localStorage.setItem(
      "page-wrapper",
      "horizontal-wrapper enterprice-type advance-layout"
    );
  });

  $(".madrid-view").click(function () {
    localStorage.setItem("page-wrapper", "compact-wrapper color-sidebar");
  });

  $(".rome-view").click(function () {
    localStorage.setItem(
      "page-wrapper",
      "compact-sidebar compact-small material-icon"
    );
  });

  $(".seoul-view").click(function () {
    localStorage.setItem("compact-wrapper modern-type");
  });

  $(".landon-view").click(function () {
    localStorage.setItem("page-wrapper", " only-body");
  });

  $(".prooduct-details-box .close").on("click", function (e) {
    var tets = $(this).parent().parent().parent().parent().addClass("d-none");
    console.log(tets);
  });
})(jQuery);
$(document).ready(function () {
  $(".navbar-toggler").click(function () {
    $(".hidenav").toggleClass("open");
  });
});
/*=====================
    Tabs Js
==========================*/
const tabs = document.querySelectorAll(".tabs");
tabs?.forEach((tab) => {
  tab.addEventListener("click", function (event) {
    const navLink = event.target.closest(".tab-link");
    if (!navLink) return;
    const allNavLinks = navLink
      .closest(".tab-links")
      ?.querySelectorAll(".tab-link");
    console.log(allNavLinks);
    allNavLinks.forEach((navLink) => {
      navLink.classList.remove("active");
    });
    navLink.classList.add("active");
    const currentTabContent = navLink.dataset.tabfilter;
    const tabContents = navLink
      .closest(".tabs")
      .parentElement.querySelectorAll(".tab-pan");
    tabContents.forEach((tabContent) => {
      tabContent.classList.remove("active");
      setTimeout(() => {
        tabContent.classList.remove("show");
      }, 400);
      tabContent.classList.remove("show");
      if (tabContent.dataset.tabcontent === currentTabContent) {
        tabContent.classList.add("active");
        setTimeout(() => {
          tabContent.classList.add("show");
        }, 400);
      }
    });
  });
});
/*=====================
    accordion Js
==========================*/
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
