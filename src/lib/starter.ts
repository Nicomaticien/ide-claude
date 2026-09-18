export const STARTER_HTML = `<header class="hero">
  <p class="eyebrow">IDE Claude</p>
  <h1>Modifie-moi.</h1>
  <p class="lede">
    Édite le HTML à gauche et le CSS en dessous.
    L’aperçu se met à jour instantanément.
  </p>
  <div class="actions">
    <a class="btn primary" href="#">Commencer</a>
    <a class="btn ghost" href="#">Voir le CSS</a>
  </div>
</header>

<section class="cards">
  <article>
    <span>01</span>
    <h2>HTML</h2>
    <p>Structure ta page ici. Change un titre, ajoute un bloc, tout se reflète à droite.</p>
  </article>
  <article>
    <span>02</span>
    <h2>CSS</h2>
    <p>Couleurs, typo, mise en page : chaque propriété s’applique en direct.</p>
  </article>
  <article>
    <span>03</span>
    <h2>Aperçu</h2>
    <p>Teste desktop, tablette ou mobile sans quitter l’éditeur.</p>
  </article>
</section>
`;

export const STARTER_CSS = `@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,700&family=Source+Sans+3:wght@400;600&display=swap");

:root {
  --ink: #1a1612;
  --muted: #6b6258;
  --paper: #f4efe6;
  --card: #fffdf8;
  --line: #e4d9c8;
  --accent: #c45c26;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  padding: 48px 24px 72px;
  background:
    radial-gradient(1200px 500px at 10% -10%, #fbe8d4 0%, transparent 55%),
    var(--paper);
  color: var(--ink);
  font-family: "Source Sans 3", system-ui, sans-serif;
}

.hero {
  max-width: 720px;
  margin: 0 auto 56px;
}

.eyebrow {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 16px;
}

h1 {
  font-family: Fraunces, Georgia, serif;
  font-size: clamp(48px, 8vw, 88px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.95;
  margin-bottom: 20px;
}

.lede {
  max-width: 34rem;
  font-size: 18px;
  line-height: 1.6;
  color: var(--muted);
  margin-bottom: 28px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 12px 18px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.btn.primary {
  background: var(--ink);
  color: var(--paper);
}

.btn.ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
}

.cards {
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

article {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 22px;
  box-shadow: 0 10px 30px rgba(26, 22, 18, 0.04);
}

article span {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 12px;
}

article h2 {
  font-family: Fraunces, Georgia, serif;
  font-size: 28px;
  margin-bottom: 8px;
}

article p {
  color: var(--muted);
  line-height: 1.55;
}
`;
