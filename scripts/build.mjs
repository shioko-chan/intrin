import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const out = path.join(root, production ? 'release' : 'dist');
const locale = 'en';
const read = async name => JSON.parse(await readFile(path.join(root, 'content', locale, `${name}.json`), 'utf8'));
const site = await read('site');
const projects = await read('projects');
const updates = (await read('updates')).sort((a, b) => b.date.localeCompare(a.date));
const ui = site.ui;
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = iso => new Intl.DateTimeFormat(locale, {day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
const projectUrl = p => `/projects/${p.id}/`;
const updateUrl = u => `/updates/${u.id}/`;
const link = (url, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}">${esc(label)}</a>`;
const tags = p => `<ul class="tags" aria-label="${esc(p.name)} topics">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
const draft = () => `<span class="draft-badge">${esc(ui.draft)}</span>`;
const extLinks = p => p.links.length ? `<div class="project-links">${p.links.map(l => link(l.url, l.label, 'button')).join('')}</div>` : `<p class="code-note">${esc(p.codeStatus)}</p>`;

function shell(title, description, body, active = '') {
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="theme-color" content="#f8f9fb">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)} · intrin${production ? "" : " — Preview"}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="preview-strip"><div class="wrap"><span>${production ? "Project notes · Work in progress" : esc(ui.draftNotice)}</span><span>${production ? "intrin.org" : "intrin.org · proposed site"}</span></div></div>
  <header class="header wrap">
    <a class="brand" href="/" aria-label="intrin home">intrin<span aria-hidden="true">.</span></a>
    <div class="publication">${esc(ui.projectNotes)}<span>By ${esc(site.author)}</span></div>
    <nav aria-label="Main navigation">
      <a href="/#projects"${active === 'projects' ? ' aria-current="page"' : ''}>${esc(ui.projects)}</a>
      <a href="/updates/"${active === 'updates' ? ' aria-current="page"' : ''}>${esc(ui.updates)}</a>
      <a class="personal-nav" href="${esc(site.personalSite)}">${esc(ui.personalSite)}</a>
    </nav>
  </header>
  <main id="main">${body}</main>
  <footer class="footer wrap">
    <div class="footer-top"><a class="brand" href="/">intrin<span aria-hidden="true">.</span></a><p>Projects & progress by ${esc(site.author)}.</p><a href="${esc(site.personalSite)}">Personal portfolio · intrin.cc</a></div>
    <div class="footer-bottom"><span>Independent work. Open questions.</span><span>${production ? "Project notes · 2026" : "Local draft · Not published"}</span></div>
  </footer>
</body>
</html>`;
}

function projectCard(p) {
  return `<article class="project-card">
    <div class="card-meta"><span class="mono">${p.number} / ${esc(p.category)}</span><span class="status ${p.id === 'skymerge' ? 'status-public' : ''}">${esc(p.status)}</span></div>
    <a class="card-media ${p.mediaKind === 'mosaic' ? 'mosaic-thumb' : ''}" href="${projectUrl(p)}" tabindex="-1" aria-hidden="true"><img src="/media/${p.poster}" alt="" width="${p.width}" height="${p.height}" decoding="async"><span class="media-label">${esc(p.mediaLabel)}</span></a>
    <div class="card-copy"><h3><a href="${projectUrl(p)}">${esc(p.name)}</a></h3><p>${esc(p.summary)}</p>${tags(p)}<a class="text-link" href="${projectUrl(p)}">${esc(ui.readProject)}<span class="sr-only">: ${esc(p.name)}</span></a></div>
  </article>`;
}

function updateRow(u) {
  const p = projects.find(p => p.id === u.projectId);
  return `<article class="update-row"><div class="update-date"><time datetime="${u.date}">${date(u.date)}</time>${draft()}</div><div class="update-copy"><p class="eyebrow">${esc(p.name)} <span>/ ${esc(u.type)}</span></p><h3><a href="${updateUrl(u)}">${esc(u.title)}</a></h3><p>${esc(u.summary)}</p></div><a class="read-update" href="${updateUrl(u)}">${esc(ui.readUpdate)}<span class="sr-only">: ${esc(u.title)}</span></a></article>`;
}

function home() {
  return shell('Projects & progress', site.description, `<section class="hero wrap" aria-labelledby="hero-title"><p class="eyebrow"><span class="short-line" aria-hidden="true"></span> Computer vision / Robot learning / World models</p><div class="hero-layout"><h1 id="hero-title">${site.heroTitle.map(esc).join("<br> ")}<span class="accent">.</span></h1><div class="hero-aside"><p>${esc(site.heroDescription)}</p><p class="byline">${esc(site.author)} <span>Independent projects</span></p></div></div></section>
  <section class="projects-section wrap" id="projects" aria-labelledby="projects-title"><div class="section-heading"><h2 id="projects-title"><span class="section-number">01</span>${esc(ui.selectedProjects)}</h2><p>Three projects. Different kinds of evidence.</p></div><div class="project-grid">${projects.map(projectCard).join('')}</div><p class="evidence-footnote">Recorded demos, a published mosaic, and work still in progress. Each project states what its evidence supports.</p></section>
  <section class="updates-section wrap" aria-labelledby="updates-title"><div class="section-heading"><h2 id="updates-title"><span class="section-number">02</span>${esc(ui.latestUpdates)}</h2>${link('/updates/', ui.allUpdates, 'text-link')}</div><div class="update-list">${updates.slice(0,3).map(updateRow).join('')}</div><p class="draft-date-note">${esc(ui.draftDateNotice)}</p></section>`, '');
}

function media(p) {
  if (p.mediaKind === 'video') return `<figure class="project-evidence video-evidence"><div class="figure-bar"><span>${esc(p.mediaLabel)}</span><span>${p.id === 'llcl' ? '11 sec / 30 fps' : '24.6 sec / 3× playback'}</span></div>${p.id === 'sketchvla' ? '<div class="camera-labels"><span>Board-front camera</span><span>Eye-in-hand camera</span></div>' : ''}<video controls muted playsinline preload="metadata" poster="/media/${p.poster}" width="${p.width}" height="${p.height}" aria-label="${esc(p.alt)}" aria-describedby="${p.id}-caption"><source src="/media/${p.video}" type="video/mp4"><track kind="captions" src="/media/${p.captions}" srclang="en" label="English descriptions" default><a href="/media/${p.video}">Open the recording</a>.</video><figcaption id="${p.id}-caption"><span class="figure-number">FIG. 01</span><p>${esc(p.mediaCaption)}</p></figcaption></figure>`;
  return `<figure class="project-evidence mosaic-evidence"><div class="figure-bar"><span>Published result / SkyMerge</span><span>Complete mosaic + output details</span></div><div class="mosaic-layout"><div class="mosaic-details"><div><img src="/media/${p.details[0]}" alt="Output detail A: solar-panel rows in the stitched mosaic" width="600" height="450"><span>Output detail A</span></div><div><img src="/media/${p.details[1]}" alt="Output detail B: a road junction within the same stitched mosaic" width="600" height="450"><span>Output detail B</span></div></div><a class="full-mosaic" href="/media/${p.image}"><img src="/media/${p.image}" alt="Complete stitched aerial mosaic of a solar farm and its access roads" width="830" height="1600"><span>Open complete mosaic</span></a></div><figcaption><span class="figure-number">FIG. 01</span><p>${esc(p.mediaCaption)}</p></figcaption></figure>`;
}

function evidenceBlocks(p) {
 return `<div class="evidence-blocks"><section><h3><span class="evidence-key">01</span>${esc(ui.verified)}</h3><p>${esc(p.verified)}</p></section><section><h3><span class="evidence-key">02</span>${esc(ui.ongoing)}</h3><p>${esc(p.ongoing)}</p></section><section><h3><span class="evidence-key">03</span>${esc(ui.next)}</h3><p>${esc(p.next)}</p></section></div>`;
}

function projectPage(p) {
 const u = updates.find(u => u.id === p.updateId);
 return shell(`${p.name} — ${p.title}`, p.summary, `<div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb">${link('/#projects', ui.backToProjects)}<span aria-hidden="true">/</span><span>${esc(p.name)}</span></nav>
 <section class="project-intro"><div><p class="eyebrow">PROJECT ${p.number} / ${esc(p.category)}</p><h1>${esc(p.name)}<span class="accent">.</span></h1><p class="project-deck">${esc(p.title)}</p><p class="project-description">${esc(p.description)}</p>${tags(p)}</div><aside class="project-facts" aria-label="Project overview"><dl><div><dt>Status</dt><dd>${esc(p.status)}</dd></div><div><dt>Period</dt><dd>${esc(p.period)}</dd></div><div><dt>Shown here</dt><dd>${esc(p.evidenceType)}</dd></div><div><dt>By</dt><dd>${esc(site.author)}</dd></div></dl>${extLinks(p)}</aside></section>
 ${media(p)}
 <div class="project-body"><aside class="contents"><p class="eyebrow">In this project</p><nav aria-label="On this page"><a href="#question">The question</a><a href="#approach">Approach</a><a href="#evidence">Evidence & limits</a><a href="#project-updates">Project updates</a></nav></aside><div class="project-writing"><section id="question"><p class="eyebrow">01 / The question</p><h2>${p.id === 'llcl' ? 'From representation to decisions.' : p.id === 'sketchvla' ? 'A task with a visible trace.' : 'Connecting separate perspectives.'}</h2><p>${esc(p.question)}</p></section><section id="approach"><p class="eyebrow">02 / Approach</p><h2>${p.id === 'llcl' ? 'The model is part of a loop.' : p.id === 'sketchvla' ? 'One motion, two viewpoints.' : 'A pipeline through geometry.'}</h2><p>${esc(p.approach)}</p><figure class="pipeline"><ol>${p.pipeline.map((s,i)=>`<li><span class="mono">0${i+1}</span><strong>${esc(s)}</strong></li>`).join('')}</ol><figcaption>Conceptual workflow · not a performance measurement</figcaption></figure></section><section id="evidence"><p class="eyebrow">03 / Evidence & limits</p><h2>What the work supports.</h2>${evidenceBlocks(p)}</section><section id="project-updates"><p class="eyebrow">04 / Project updates</p><div class="related-update">${draft()}<time datetime="${u.date}">${date(u.date)}</time><h3><a href="${updateUrl(u)}">${esc(u.title)}</a></h3><p>${esc(u.summary)}</p>${link(updateUrl(u),ui.readUpdate,'text-link')}</div></section></div></div>
 <nav class="other-projects" aria-label="Other projects"><p class="eyebrow">Continue exploring</p>${projects.filter(other=>other.id!==p.id).map(other=>`<a href="${projectUrl(other)}"><span>${other.number} / ${esc(other.category)}</span><strong>${esc(other.name)}</strong></a>`).join('')}</nav></div>`, 'projects');
}

function updatesPage() {
 return shell('Updates', 'Draft progress notes linked to projects, with verified evidence, ongoing work and proposed next steps.', `<div class="wrap"><section class="updates-intro"><p class="eyebrow">THE WORK, AS IT DEVELOPS</p><h1>Updates<span class="accent">.</span></h1><p>Short notes on project artifacts, open questions and next steps.</p><div class="draft-callout">${draft()}<p>These entries are prepared for content review. ${esc(ui.draftDateNotice)}</p></div></section><div class="update-list archive-list">${updates.map(updateRow).join('')}</div><div class="update-key"><h2>How to read an update</h2><div><p><strong>Verified evidence</strong>What the available artifact or recording supports.</p><p><strong>Ongoing work</strong>What is being explored, with limits stated.</p><p><strong>Proposed next steps</strong>A suggested direction, not a completed result.</p></div></div></div>`, 'updates');
}

function updatePage(u) {
 const p=projects.find(p=>p.id===u.projectId);
 return shell(`${u.title} — ${p.name}`,u.summary,`<div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb">${link('/updates/', ui.allUpdates)}<span aria-hidden="true">/</span>${link(projectUrl(p),p.name)}</nav><article class="note"><header class="note-header"><div class="note-meta">${draft()}<time datetime="${u.date}">${date(u.date)}</time><span>${esc(u.type)}</span></div><p class="eyebrow">${link(projectUrl(p),p.name)}</p><h1>${esc(u.title)}</h1><p class="note-deck">${esc(u.summary)}</p><p class="note-author">By ${esc(site.author)}</p></header><div class="note-body"><p class="note-intro">${esc(u.intro)}</p><aside class="draft-callout"><p>Content-review draft. This date records the preparation of this note, not a new experiment or release.</p></aside>${evidenceBlocks(u)}<div class="note-project"><div><p class="eyebrow">RELATED PROJECT</p><h2>${esc(p.name)}</h2><p>${esc(p.mediaShortCaption)}</p>${link(projectUrl(p),'View project & evidence','button')}</div><a href="${projectUrl(p)}" tabindex="-1" aria-hidden="true"><img src="/media/${p.poster}" alt="" width="${p.width}" height="${p.height}" loading="lazy"></a></div></div></article><div class="note-back">${link('/updates/',ui.allUpdates,'text-link')}</div></div>`, 'updates');
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(path.join(root,'public'),out,{recursive:true});
const writePage = async (relative, html) => { if (production && relative !== '404.html') { const route = '/' + relative.replace(/index\.html$/, ''); html = html.replace('  <link rel="icon"', `  <link rel="canonical" href="https://intrin.org${route}">\n  <link rel="icon"`); } const dest=path.join(out,relative); await mkdir(path.dirname(dest),{recursive:true}); await writeFile(dest,html); };
await writePage('index.html',home());
for (const p of projects) await writePage(`projects/${p.id}/index.html`,projectPage(p));
await writePage('updates/index.html',updatesPage());
for (const u of updates) await writePage(`updates/${u.id}/index.html`,updatePage(u));
await writePage('404.html',shell('Page not found','This page could not be found.',`<section class="not-found wrap"><p class="eyebrow">404 / Page not found</p><h1>Back to the work<span class="accent">.</span></h1><p>This page could not be found.</p>${link('/','View projects','button')}</section>`));
if (production) await writeFile(path.join(out, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'self'; media-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\n`);
console.log(`Built ${1 + projects.length + 1 + updates.length + 1} static pages in ${production ? 'release' : 'dist'}/. ${production ? 'Prepared for intrin.org; draft indexing restrictions retained.' : 'Local draft only.'}`);
