/*! -----------------------------------------------------------------------------------

    Template Name: Cuba Admin
    Template URI: http://admin.pixelstrap.com/cuba/template
    Description: This is Admin theme
    Author: Pixelstrap
    Author URI: https://themeforest.net/user/pixelstrap

-----------------------------------------------------------------------------------

        01. Password show hide
        02. Background Image js
        03. sidebar filter
        04. Language js
        05. Translate js

 --------------------------------------------------------------------------------- */

(function ($) {
  "use strict";

  $(document).on("click", function (e) {
    var outside_space = $(".outside");
    if (!outside_space.is(e.target) && outside_space.has(e.target).length === 0) {
      $(".menu-to-be-close").removeClass("block");
      $(".menu-to-be-close").css("display", "none");
    }
  });
  $(document).ready(function () {
    function hasRequiredClasses() {
      return $(".page-wrapper.horizontal-wrapper").length > 0;
    }
    $(document).on("mouseenter", "li", function (e) {
      if (!hasRequiredClasses()) return;

      e.stopPropagation();
      console.log("Hovered In on li");
      $(this).children("ul.sidebar-submenu").css("display", "block");
      $(this).addClass("hoverd");
    });

    $(document).on("mouseleave", "li", function (e) {
      if (!hasRequiredClasses()) return;

      e.stopPropagation();
      console.log("Hovered Out from li");
      $(this).children("ul.sidebar-submenu").css("display", "none");
      $(this).removeClass("hoverd");
    });

    $(window).on("scroll", function () {
      if (!hasRequiredClasses()) return;

      if ($(this).scrollTop() < 600) {
        $("li").removeClass("hoverd");
        $("ul.sidebar-submenu").css("display", "none");
      }
    });
  });
  /*----------------------------------------
     password show hide
     ----------------------------------------*/
  $(".show-hide").show();
  $(".show-hide span").addClass("show");

  $(".show-hide span").click(function () {
    if ($(this).hasClass("show")) {
      $('input[name="login[password]"]').attr("type", "text");
      $(this).removeClass("show");
    } else {
      $('input[name="login[password]"]').attr("type", "password");
      $(this).addClass("show");
    }
  });
  $('form button[type="submit"]').on("click", function () {
    $(".show-hide span").addClass("show");
    $(".show-hide").parent().find('input[name="login[password]"]').attr("type", "password");
  });

  /*=====================
      02. Background Image js
      ==========================*/
  $(".bg-center").parent().addClass("b-center");
  $(".bg-img-cover").parent().addClass("bg-size");
  $(".bg-img-cover").each(function () {
    var el = $(this),
      src = el.attr("src"),
      parent = el.parent();
    parent.css({
      "background-image": "url(" + src + ")",
      "background-size": "cover",
      "background-position": "center",
      display: "block",
    });
    el.hide();
  });

  $(".mega-menu-container").css("display", "none");
  $(".header-search").click(function () {
    $(".search-full").addClass("open");
  });
  $(".close-search").click(function () {
    $(".search-full").removeClass("open");
    $("body").removeClass("offcanvas");
  });
  $(".mobile-toggle").click(function () {
    $(".nav-menus").toggleClass("open");
  });
  $(".mobile-toggle-left").click(function () {
    $(".left-header").toggleClass("open");
  });
  $(".bookmark-search").click(function () {
    $(".form-control-search").toggleClass("open");
  });
  $(".filter-toggle").click(function () {
    $(".product-sidebar").toggleClass("open");
  });
  $(".toggle-data").click(function () {
    $(".product-wrapper").toggleClass("sidebaron");
  });
  $(".form-control-search input").keyup(function (e) {
    if (e.target.value) {
      $(".page-wrapper").addClass("offcanvas-bookmark");
    } else {
      $(".page-wrapper").removeClass("offcanvas-bookmark");
    }
  });
  $(".search-full input").keyup(function (e) {
    console.log(e.target.value);
    if (e.target.value) {
      $("body").addClass("offcanvas");
    } else {
      $("body").removeClass("offcanvas");
    }
  });

  $("body").keydown(function (e) {
    if (e.keyCode == 27) {
      $(".search-full input").val("");
      $(".form-control-search input").val("");
      $(".page-wrapper").removeClass("offcanvas-bookmark");
      $(".search-full").removeClass("open");
      $(".search-form .form-control-search").removeClass("open");
      $("body").removeClass("offcanvas");
    }
  });
  $(".mode").on("click", function () {
    const bodyModeDark = $("body").hasClass("dark-only");

    if (!bodyModeDark) {
      $(".mode").addClass("active");
      localStorage.setItem("mode-cuba", "dark-only");
      $("body").addClass("dark-only");
      $("body").removeClass("light");
    }
    if (bodyModeDark) {
      $(".mode").removeClass("active");
      localStorage.setItem("mode-cuba", "light");
      $("body").removeClass("dark-only");
      $("body").addClass("light");
    }
  });
  $("body").addClass(localStorage.getItem("mode-cuba") ? localStorage.getItem("mode-cuba") : "light");
  $(".mode").addClass(localStorage.getItem("mode-cuba") === "dark-only" ? "active" : " ");

  // sidebar filter
  $(".md-sidebar .md-sidebar-toggle ").on("click", function (e) {
    $(".md-sidebar .md-sidebar-aside ").toggleClass("open");
  });

  $(".loader-wrapper").fadeOut("slow", function () {
    $(this).remove();
  });

  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 600) {
      $(".tap-top").fadeIn();
    } else {
      $(".tap-top").fadeOut();
    }
  });

  $(".tap-top").click(function () {
    $("html, body").animate(
      {
        scrollTop: 0,
      },
      600
    );
    return false;
  });
  (function ($, window, document, undefined) {
    "use strict";
    var $ripple = $(".js-ripple");
    $ripple.on("click.ui.ripple", function (e) {
      var $this = $(this);
      var $offset = $this.parent().offset();
      var $circle = $this.find(".c-ripple__circle");
      var x = e.pageX - $offset.left;
      var y = e.pageY - $offset.top;
      $circle.css({
        top: y + "px",
        left: x + "px",
      });
      $this.addClass("is-active");
    });
    $ripple.on("animationend webkitAnimationEnd oanimationend MSAnimationEnd", function (e) {
      $(this).removeClass("is-active");
    });
  })(jQuery, window, document);

  // active link
  $(".chat-menu-icons .toogle-bar").click(function () {
    $(".chat-menu").toggleClass("show");
  });

  // Language
  var tnum = "en";

  $(document).ready(function () {
    function hexToRgbValuesOnly(hex) {
      hex = hex.replace("#", "");
      var bigint = parseInt(hex, 16);
      var r = (bigint >> 16) & 255;
      var g = (bigint >> 8) & 255;
      var b = bigint & 255;
      return `${r}, ${g}, ${b}`;
    }

    $(document).ready(function () {
      if (localStorage.getItem("primary") != null) {
        var primaryHex = localStorage.getItem("primaryHex");
        $("#ColorPicker1").val(primaryHex);

        var secondaryHex = localStorage.getItem("secondaryHex");
        $("#ColorPicker2").val(secondaryHex);

        var primaryRgbValues = localStorage.getItem("primary");
        var secondaryRgbValues = localStorage.getItem("secondary");

        console.log("Primary RGB values:", primaryRgbValues);
        console.log("Secondary RGB values:", secondaryRgbValues);
      }

      $(".color-apply-btn").on("click", function () {
        var primaryHex = $("#ColorPicker1").val();
        var secondaryHex = $("#ColorPicker2").val();

        var primaryRgbValues = hexToRgbValuesOnly(primaryHex);
        var secondaryRgbValues = hexToRgbValuesOnly(secondaryHex);

        localStorage.setItem("primaryHex", primaryHex);
        localStorage.setItem("secondaryHex", secondaryHex);
        localStorage.setItem("primary", primaryRgbValues);
        localStorage.setItem("secondary", secondaryRgbValues);

        console.log("Saved Primary RGB values:", primaryRgbValues);
        console.log("Saved Secondary RGB values:", secondaryRgbValues);
      });
    });

    $(document).click(function (e) {
      $(".translate_wrapper, .more_lang").removeClass("active");
    });
    $(".translate_wrapper .current_lang").click(function (e) {
      e.stopPropagation();
      $(this).parent().toggleClass("active");

      setTimeout(function () {
        $(".more_lang").toggleClass("active");
      }, 5);
    });

    /*TRANSLATE*/
    translate(tnum);

    $(".more_lang .lang").click(function () {
      $(this).addClass("selected").siblings().removeClass("selected");
      $(".more_lang").removeClass("active");

      var i = $(this).find("i").attr("class");
      var lang = $(this).attr("data-value");
      var tnum = lang;
      translate(tnum);

      $(".current_lang .lang-txt").text(lang);
      $(".current_lang i").attr("class", i);
    });
  });

  function translate(tnum) {
    $(".lan-1").text(trans[0][tnum]);
    $(".lan-2").text(trans[1][tnum]);
    $(".lan-3").text(trans[2][tnum]);
    $(".lan-4").text(trans[3][tnum]);
    $(".lan-5").text(trans[4][tnum]);
    $(".lan-6").text(trans[5][tnum]);
    $(".lan-7").text(trans[6][tnum]);
    $(".lan-8").text(trans[7][tnum]);
    $(".lan-9").text(trans[8][tnum]);
  }

  var trans = [
    {
      en: "General",
      pt: "Geral",
      es: "Generalo",
      fr: "GÃ©nÃ©rale",
      de: "Generel",
      cn: "ä¸€èˆ¬",
      ae: "Ø­Ø¬Ù†Ø±Ø§Ù„ Ù„ÙˆØ§Ø¡",
    },
    {
      en: "Dashboards,widgets & layout.",
      pt: "PainÃ©is, widgets e layout.",
      es: "Paneloj, fenestraÄµoj kaj aranÄo.",
      fr: "Tableaux de bord, widgets et mise en page.",
      de: "Dashboards, widgets en lay-out.",
      cn: "ä»ªè¡¨æ¿ï¼Œå°å·¥å…·å’Œå¸ƒå±€ã€‚",
      ae: "Ù„ÙˆØ­Ø§Øª Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª ÙˆØ§Ù„Ø£Ø¯ÙˆØ§Øª ÙˆØ§Ù„ØªØ®Ø·ÙŠØ·.",
    },
    {
      en: "Dashboards",
      pt: "PainÃ©is",
      es: "Paneloj",
      fr: "Tableaux",
      de: "Dashboards",
      cn: " ä»ªè¡¨æ¿ ",
      ae: "ÙˆØ­Ø§Øª Ø§Ù„Ù‚ÙŠØ§Ø¯Ø© ",
    },
    {
      en: "Default",
      pt: "PadrÃ£o",
      es: "Vaikimisi",
      fr: "DÃ©faut",
      de: "Standaard",
      cn: "é›»å­å•†å‹™",
      ae: "ÙˆØ¥ÙØªØ±Ø§Ø¶ÙŠ",
    },
    {
      en: "Ecommerce",
      pt: "ComÃ©rcio eletrÃ´nico",
      es: "Komerco",
      fr: "Commerce Ã©lectronique",
      de: "E-commerce",
      cn: "é›»å­å•†å‹™",
      ae: "ÙˆØ§Ù„ØªØ¬Ø§Ø±Ø© Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©",
    },
    {
      en: "Widgets",
      pt: "Ferramenta",
      es: "Vidin",
      fr: "Widgets",
      de: "Widgets",
      cn: "å°éƒ¨ä»¶",
      ae: "ÙˆØ§Ù„Ø­Ø§Ø¬ÙŠØ§Øª",
    },
    {
      en: "Page layout",
      pt: "Layout da pÃ¡gina",
      es: "PaÄa aranÄo",
      fr: "Tableaux",
      de: "Mise en page",
      cn: "é é¢ä½ˆå±€",
      ae: "ÙˆØªØ®Ø·ÙŠØ· Ø§Ù„ØµÙØ­Ø©",
    },
    {
      en: "Applications",
      pt: "FormulÃ¡rios",
      es: "Aplikoj",
      fr: "Applications",
      de: "Toepassingen",
      cn: "æ‡‰ç”¨é ˜åŸŸ",
      ae: "ÙˆØ§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª",
    },
    {
      en: "Ready to use Apps",
      pt: "Pronto para usar aplicativos",
      es: "Preta uzi Apps",
      fr: " Applications prÃªtes Ã  lemploi ",
      de: "Klaar om apps te gebruiken",
      cn: "ä»ªè¡¨æ¿",
      ae: "Ø¬Ø§Ù‡Ø² Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª",
    },
  ];

  $(".mobile-title svg").click(function () {
    $(".header-mega").toggleClass("block");
  });

  $(".onhover-dropdown").on("click", function () {
    $(this).children(".onhover-show-div").toggleClass("active");
  });

  $("#flip-btn").click(function () {
    $(".flip-card-inner").addClass("flipped");
  });

  $("#flip-back").click(function () {
    $(".flip-card-inner").removeClass("flipped");
  });
})(jQuery);
/*=====================
    Tabs Js
==========================*/
const tabs = document.querySelectorAll(".tabs");
tabs?.forEach(tab => {
  tab.addEventListener("click", function (event) {
    const navLink = event.target.closest(".tab-link");
    if (!navLink) return;
    const allNavLinks = navLink.closest(".tab-links")?.querySelectorAll(".tab-link");
    console.log(allNavLinks);
    allNavLinks.forEach(navLink => {
      navLink.classList.remove("active");
    });
    navLink.classList.add("active");
    const currentTabContent = navLink.dataset.tabfilter;
    const tabContents = navLink.closest(".tabs").parentElement.querySelectorAll(".tab-pan");
    tabContents.forEach(tabContent => {
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
    dropdown Js
==========================*/
document.addEventListener("click", function (event) {
  const dropdown = event.target.closest(".dropdown, .btn-group");
  const allMenus = document.querySelectorAll(".dropdown-menu");
  if (!dropdown) {
    allMenus.forEach(menu => {
      menu.classList.remove("show");
    });
  } else {
    const menu = dropdown.querySelector(".dropdown-menu");
    if (menu.classList.contains("show")) {
      menu.classList.remove("show");
    } else {
      allMenus.forEach(otherMenu => {
        otherMenu.classList.remove("show");
      });
      if (menu) {
        menu.classList.add("show");
      }
    }
  }
});

/*=====================
    offcanvas Js
==========================*/
document.querySelectorAll('[data-bs-toggle="offcanvas"]').forEach(trigger => {
  trigger.addEventListener("click", function (event) {
    event.preventDefault();
    const targetId = this.getAttribute("data-bs-target") || this.getAttribute("href");
    const targetElement = document.querySelector(targetId);

    if (targetElement) {
      const isShown = targetElement.classList.toggle("show");
      let backdrop = targetElement.nextElementSibling;
      if (isShown) {
        if (!backdrop || !backdrop.classList.contains("offcanvas-backdrop")) {
          backdrop = document.createElement("div");
          backdrop.className = "offcanvas-backdrop";
          targetElement.insertAdjacentElement("afterend", backdrop);
        }
      } else {
        if (backdrop && backdrop.classList.contains("offcanvas-backdrop")) {
          backdrop.remove();
        }
      }
      const closeButton = targetElement.querySelector(".offcanvas-header .btn-close");
      if (closeButton) {
        closeButton.addEventListener("click", () => {
          targetElement.classList.remove("show");
          if (backdrop && backdrop.classList.contains("offcanvas-backdrop")) {
            backdrop.remove();
          }
        });
      }
    }
  });
});

/*=====================
    selectpicker js
==========================*/
$(document).ready(function () {
  $(".selectpicker").each(function () {
    let $select = $(this);
    let $dropdown = $("<div class='custom-dropdown'></div>").insertAfter($select);
    let $button = $("<button type='button' class='dropdown-toggle'>" + $select.find("option:selected").text() + "</button>").appendTo($dropdown);
    let $menu = $("<div class='dropdown-menu'></div>").appendTo($dropdown);
    let $searchBox = $("<input type='text' class='dropdown-search' placeholder='Search...'>").appendTo($menu);
    let $list = $("<ul class='dropdown-list'></ul>").appendTo($menu);

    $select.find("option").each(function () {
      let $item = $("<li class='dropdown-item' data-value='" + $(this).val() + "'>" + $(this).text() + "</li>");
      $list.append($item);
    });

    $button.on("click", function (e) {
      e.preventDefault(); // Prevents page refresh
      $menu.toggle();
    });

    $searchBox.on("keyup", function () {
      let searchText = $(this).val().toLowerCase();
      $list.children().each(function () {
        $(this).toggle($(this).text().toLowerCase().includes(searchText));
      });
    });

    $list.on("click", ".dropdown-item", function (e) {
      e.preventDefault(); // Prevents page refresh
      let selectedText = $(this).text();
      $button.text(selectedText);
      $select.val($(this).data("value")).trigger("change");
      $menu.hide();
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest(".custom-dropdown").length) {
        $menu.hide();
      }
    });

    $select.hide();
  });
});
/*=====================
    Notification js
==========================*/

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".notification-dropdown .btn-close").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const toastItem = this.closest("li");
      if (toastItem) {
        toastItem.remove();
      }
    });
  });
});
