// Navegación por pasos: los enlaces del header saltan a cada sección (con scroll
// suave nativo) y se resalta la sección visible. Solo se ocupa del DOM.

export function initSectionNav() {
  const links = [...document.querySelectorAll("#section-nav a[data-nav]")];
  if (links.length === 0) return;

  const setActive = (id) => links.forEach((link) => link.classList.toggle("is-active", link.dataset.nav === id));
  setActive(links[0].dataset.nav);

  // Al pulsar un paso se marca de inmediato y se silencia el observer durante el
  // desplazamiento, para que el clic mande aunque la página sea corta.
  let suppressUntil = 0;
  for (const link of links) {
    link.addEventListener("click", () => {
      setActive(link.dataset.nav);
      suppressUntil = Date.now() + 800;
    });
  }

  if (typeof IntersectionObserver === "undefined") return; // el salto por enlace sigue funcionando

  const visible = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      if (Date.now() < suppressUntil) return;
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      // Entre las secciones visibles bajo la cabecera, la activa es la más alta.
      let topId = null;
      let topY = Infinity;
      for (const id of visible) {
        const top = document.getElementById(id).getBoundingClientRect().top;
        if (top < topY) {
          topY = top;
          topId = id;
        }
      }
      if (topId) setActive(topId);
    },
    // La sección cuenta como visible cuando su parte superior cruza la banda bajo la cabecera.
    { rootMargin: "-110px 0px -70% 0px", threshold: 0 },
  );
  for (const link of links) {
    const section = document.getElementById(link.dataset.nav);
    if (section) observer.observe(section);
  }
}
