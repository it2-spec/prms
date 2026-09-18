document.querySelectorAll("[data-tooltip]").forEach(el => {
  el.style.position = "relative";

  el.addEventListener("mouseenter", () => {
    const tooltipText = el.getAttribute("data-tooltip");
    let tooltip = document.createElement("div");
    tooltip.className = "absolute z-10 rounded-md ";
    tooltip.style.top = "-100%";
    tooltip.style.left = "50%";
    tooltip.style.fontFamily = "Roboto";
    tooltip.style.padding = "6px 12px";
    tooltip.style.fontSize = "14px";
    tooltip.style.backgroundColor = "#eae8ff";
    tooltip.style.color = "rgba(var(--theme-default),1)";
    tooltip.style.fontWeight = "400";
    tooltip.style.transform = "translate(-50%, -50%)";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.innerText = tooltipText;
    let afterElement = document.createElement("div");
    afterElement.style.height = "12px";
    afterElement.style.width = "12px";
    afterElement.style.backgroundColor = "#eae8ff";
    afterElement.style.transform = "rotate(45deg) translateX(-50%)";
    afterElement.style.position = "absolute";
    afterElement.style.bottom = "-10px";
    afterElement.style.left = "50%";
    afterElement.style.zIndex = "-1";
    afterElement.style.content = '""';
    tooltip.appendChild(afterElement);

    el.appendChild(tooltip);
    el.tooltipEl = tooltip;
  });

  el.addEventListener("mouseleave", () => {
    if (el.tooltipEl) {
      el.tooltipEl.remove();
      el.tooltipEl = null;
    }
  });
});
