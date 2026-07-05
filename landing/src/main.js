// Landing page behavior: accessible FAQ accordion + footer year.

document.querySelectorAll(".acc-q").forEach((q) => {
  q.addEventListener("click", () => {
    const acc = q.parentElement;
    const open = acc.classList.toggle("open");
    q.setAttribute("aria-expanded", String(open));
  });
});

const year = document.getElementById("year");
if (year) year.textContent = String(new Date().getFullYear());
