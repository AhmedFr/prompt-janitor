// Landing page behavior: Polar checkout links, accessible FAQ accordion, footer year.

const POLAR_CHECKOUT_URL = "https://buy.polar.sh/polar_cl_PLACEHOLDER"; // TODO(#78): replace with the real Polar checkout link

document.querySelectorAll("a[data-polar-checkout]").forEach((a) => {
  a.href = POLAR_CHECKOUT_URL;
  a.target = "_blank";
  a.rel = "noopener";
});

document.querySelectorAll(".acc-q").forEach((q) => {
  q.addEventListener("click", () => {
    const acc = q.parentElement;
    const open = acc.classList.toggle("open");
    q.setAttribute("aria-expanded", String(open));
  });
});

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
