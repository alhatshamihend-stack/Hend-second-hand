(() => {
  function extractProductData() {
    const title = document.querySelector(".product-name")?.textContent?.trim() || document.title || "Unknown Item";
    const price = document.querySelector(".price")?.textContent?.trim() || "";
    const condition = document.querySelector(".degree-num")?.textContent?.trim() || document.querySelector(".unused")?.textContent?.trim() || "B";
    const images = Array.from(document.querySelectorAll(".image img, .product-image img, img"))
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
      .filter(Boolean)
      .slice(0, 10);

    return {
      title,
      price,
      condition,
      images,
      captured_at: new Date().toISOString(),
    };
  }

  const payload = extractProductData();
  window.postMessage({ source: "zzer-injected", payload }, "*");
})();
