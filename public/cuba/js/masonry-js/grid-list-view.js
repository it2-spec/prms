/*=====================
  Grid & List js
==========================*/

const gridView = document.querySelector('.grid-layout-view');
const listView = document.querySelector('.list-layout-view');
const productWrapperGrid = document.querySelector('.product-wrapper-grid');
gridView?.addEventListener('click', function () {
    productWrapperGrid.classList.remove("list-view"); 
}); 
listView?.addEventListener('click', function () {
    productWrapperGrid.classList.add("list-view");
}); 