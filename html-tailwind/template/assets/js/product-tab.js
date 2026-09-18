// Product grid JS

(function ($) {
  //list layout view
  $(".grid-layout-view").on("click", function (e) {
    $(".product-wrapper-grid").removeClass("list-view");
    $(".product-wrapper-grid").children().children().removeClass("col-span-12");
  });
  $(".list-layout-view").on("click", function (e) {
    $(".collection-grid-view").css("opacity", "0");
    $(".product-wrapper-grid").css("opacity", "0.2");
    $(".product-wrapper-grid").addClass("list-view");
    $(".product-wrapper-grid").children().children();
    $(".product-wrapper-grid").children().children().addClass("col-span-12");
    setTimeout(function () {
      $(".product-wrapper-grid").css("opacity", "1");
    }, 500);
  });

  // owl carousel
  $(document).ready(function () {
    $("#testimonial").owlCarousel({
      items: 1,
      margin: 30,
      loop: true,
      pagination: true,
      navigationText: true,
      dots: false,
      nav: true,
    });
  });

  // grid options
  $(".product-2-layout-view").on("click", function (e) {
    if ($(".product-wrapper-grid").hasClass("list-view")) {
    } else {
      $(".product-wrapper-grid").children().children().removeClass();
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-6 xl:col-span-12");
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-6 sm:col-span-12");
    }
  });
  $(".product-3-layout-view").on("click", function (e) {
    if ($(".product-wrapper-grid").hasClass("list-view")) {
    } else {
      $(".product-wrapper-grid").children().children().removeClass();
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-4 xl:col-span-12");
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-4 sm:col-span-12");
    }
  });
  $(".product-4-layout-view").on("click", function (e) {
    if ($(".product-wrapper-grid").hasClass("list-view")) {
    } else {
      $(".product-wrapper-grid").children().children().removeClass();
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-3 xl:col-span-12");
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-3 sm:col-span-12");
    }
  });
  $(".product-6-layout-view").on("click", function (e) {
    if ($(".product-wrapper-grid").hasClass("list-view")) {
    } else {
      $(".product-wrapper-grid").children().children().removeClass();
      $(".product-wrapper-grid")
        .children()
        .children()
        .addClass("col-span-2 xl:col-span-12");
    }
  });
})(jQuery);
