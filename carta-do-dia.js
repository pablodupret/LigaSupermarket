const imgCarta = document.getElementById("carta-img");
const btnNovaCarta = document.getElementById("btn-nova-carta");

// Segurança: se não achar elementos, não quebra a página
if (imgCarta && btnNovaCarta) {
  async function carregarCartaAleatoria() {
    try {
      // Exemplo simples: carta aleatória no Scryfall da coleçao ECL (silga do Lorwyn)
      //Na próxima coleção precisa trocar o set abaixo!
      const resp = await fetch("https://api.scryfall.com/cards/random?q=set:ecl");


      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();

      // Alguns cards têm image_uris, outros (double-faced) têm card_faces
      const url =
        data.image_uris?.normal ||
        data.card_faces?.[0]?.image_uris?.normal;

      if (!url) {
        throw new Error("Sem URL de imagem para esta carta.");
      }

      imgCarta.src = url;
      
    } catch (err) {
      console.error("Erro ao carregar carta:", err);
      // fallback visual simples (opcional)
      imgCarta.removeAttribute("src");
      imgCarta.alt = "Não foi possível carregar a carta agora.";
    }
  }

  // Carrega uma carta ao abrir a página
  carregarCartaAleatoria();

  // Botão para pegar outra carta
  btnNovaCarta.addEventListener("click", carregarCartaAleatoria);
}
