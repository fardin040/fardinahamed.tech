/* ===============================================================
   main.js — Portfolio Interactive Behaviours
   =============================================================== */

(function () {
  'use strict';

  const CMS_SOURCE = window.CMS_CONTENT_SOURCE || {
    owner: 'fardin040',
    repo: 'fardinahamed.tech',
    branch: 'main'
  };

  const GH_API_BASE = `https://api.github.com/repos/${CMS_SOURCE.owner}/${CMS_SOURCE.repo}/contents`;
  const GH_RAW_BASE = `https://raw.githubusercontent.com/${CMS_SOURCE.owner}/${CMS_SOURCE.repo}/${CMS_SOURCE.branch}`;
  const LOCAL_MANIFESTS = {
    projects: '/content/projects/_index.json',
    blog: '/content/blog/_index.json'
  };

  const githubIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
      <path d="M9 18c-4.51 2-5-2-7-2"/>
    </svg>`;

  const arrowIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" aria-hidden="true">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>`;

  let revealObserver = null;

  function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value, fallback = '#') {
    if (!value || !String(value).trim()) return fallback;
    try {
      const parsed = new URL(value, window.location.origin);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return fallback;
      return parsed.href;
    } catch {
      return fallback;
    }
  }

  function simpleHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function withCacheKey(url, key) {
    if (!url || !key) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) return url;
      parsed.searchParams.set('cmsv', key);
      return parsed.href;
    } catch {
      return url;
    }
  }

  function createRevealObserver() {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -56px 0px' }
    );
  }

  function observeRevealElements(scope) {
    if (!revealObserver) return;
    const elements = scope.querySelectorAll('.reveal, .reveal--left, .reveal--right');
    elements.forEach((el) => revealObserver.observe(el));
  }

  function getDelayClass(index) {
    const slot = (index % 5) + 1;
    return `reveal-delay-${slot}`;
  }

  function parseMarkdownFile(markdown) {
    const data = {};
    let body = markdown;

    if (markdown.startsWith('---')) {
      const parts = markdown.split('---');
      if (parts.length >= 3) {
        const frontMatter = parts[1].trim();
        body = parts.slice(2).join('---').trim();

        let currentListKey = '';
        frontMatter.split('\n').forEach((line) => {
          if (!line.trim()) return;

          if (/^\s*-\s+/.test(line) && currentListKey) {
            if (!Array.isArray(data[currentListKey])) data[currentListKey] = [];
            data[currentListKey].push(line.replace(/^\s*-\s+/, '').trim().replace(/^"|"$/g, ''));
            return;
          }

          const separatorIndex = line.indexOf(':');
          if (separatorIndex === -1) return;

          const key = line.slice(0, separatorIndex).trim();
          const value = line.slice(separatorIndex + 1).trim();
          currentListKey = key;

          if (!value) {
            data[key] = [];
            return;
          }

          // Parse inline lists: [a, b, c]
          if (value.startsWith('[') && value.endsWith(']')) {
            data[key] = value
              .slice(1, -1)
              .split(',')
              .map((item) => item.trim().replace(/^"|"$/g, ''))
              .filter(Boolean);
            return;
          }

          data[key] = value.replace(/^"|"$/g, '');
        });
      }
    }

    return { data, body };
  }

  function stripMarkdown(markdown) {
    return markdown
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
      .replace(/\[[^\]]*\]\([^\)]*\)/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/[>*_~\-]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  }

  async function fetchMarkdownCollectionFromGitHub(folderPath) {
    const listResponse = await fetchWithTimeout(`${GH_API_BASE}/${folderPath}?ref=${CMS_SOURCE.branch}`, {}, 10000);
    if (!listResponse.ok) {
      throw new Error(`Could not load ${folderPath} list from GitHub API.`);
    }

    const files = await listResponse.json();
    const markdownFiles = files
      .filter((item) => item.type === 'file' && item.name.endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const results = await Promise.all(
      markdownFiles.map(async (file) => {
        const textResponse = await fetchWithTimeout(`${GH_RAW_BASE}/${folderPath}/${file.name}`, {}, 10000);
        if (!textResponse.ok) return null;
        const markdown = await textResponse.text();
        const parsed = parseMarkdownFile(markdown);
        return {
          slug: file.name.replace(/\.md$/, ''),
          ...parsed
        };
      })
    );

    return results.filter(Boolean);
  }

  async function fetchMarkdownCollectionFromManifest(manifestPath) {
    const manifestResponse = await fetchWithTimeout(manifestPath, { cache: 'no-store' }, 8000);
    if (!manifestResponse.ok) {
      throw new Error(`Could not load manifest: ${manifestPath}`);
    }

    const manifest = await manifestResponse.json();
    const files = Array.isArray(manifest?.files) ? manifest.files : [];
    if (!files.length) return [];

    const results = await Promise.all(
      files.map(async (filePath) => {
        const textResponse = await fetchWithTimeout(filePath, { cache: 'no-store' }, 8000);
        if (!textResponse.ok) return null;
        const markdown = await textResponse.text();
        const parsed = parseMarkdownFile(markdown);
        const filename = filePath.split('/').pop() || '';
        return {
          slug: filename.replace(/\.md$/, ''),
          ...parsed
        };
      })
    );

    return results.filter(Boolean);
  }

  async function fetchMarkdownCollection(folderPath, manifestPath) {
    const [manifestResult, githubResult] = await Promise.allSettled([
      fetchMarkdownCollectionFromManifest(manifestPath),
      fetchMarkdownCollectionFromGitHub(folderPath)
    ]);

    const merged = new Map();
    const sources = [manifestResult, githubResult];

    sources.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      result.value.forEach((entry) => {
        merged.set(entry.slug, entry);
      });
    });

    if (!merged.size) {
      throw new Error(`Could not load content for ${folderPath}.`);
    }

    return Array.from(merged.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  }

  function renderProjects(projectDocs) {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    if (!projectDocs.length) {
      grid.innerHTML = '<p class="content-empty reveal">No projects published yet.</p>';
      observeRevealElements(grid);
      return;
    }

    grid.innerHTML = '';
    projectDocs.forEach((doc, index) => {
      const meta = doc.data || {};
      const techs = Array.isArray(meta.technologies) ? meta.technologies : [];
      const title = escapeHtml(meta.title || doc.slug);
      const description = escapeHtml((meta.description || stripMarkdown(doc.body).slice(0, 190)).trim());
      const githubLink = safeUrl(meta.github_link || 'https://github.com/fardin040', 'https://github.com/fardin040');
      const image = safeUrl(meta.image || '', '');

      const card = document.createElement('article');
      card.className = `project-card reveal ${getDelayClass(index)}`;
      card.innerHTML = `
        ${image ? `<img class="project-card__image" src="${image}" alt="${title}" loading="lazy" decoding="async" />` : ''}
        <div class="project-card__header">
          <div class="project-card__icon" aria-hidden="true">💼</div>
          <a
            href="${githubLink}"
            target="_blank"
            rel="noopener noreferrer"
            class="project-card__link"
            aria-label="View ${title} on GitHub"
          >${githubIcon}</a>
        </div>
        <h3 class="project-card__title">${title}</h3>
        <p class="project-card__desc">${description}</p>
        <div class="project-card__techs">
          ${techs.map((tech) => `<span class="tech-tag">${escapeHtml(tech)}</span>`).join('')}
        </div>
      `;
      grid.appendChild(card);
    });

    observeRevealElements(grid);
  }

  function renderBlogPosts(blogDocs) {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    if (!blogDocs.length) {
      grid.innerHTML = '<p class="content-empty reveal">No blog posts published yet.</p>';
      observeRevealElements(grid);
      return;
    }

    const sorted = blogDocs.slice().sort((a, b) => {
      const aDate = new Date(a.data?.date || '1970-01-01').getTime();
      const bDate = new Date(b.data?.date || '1970-01-01').getTime();
      return bDate - aDate;
    });

    grid.innerHTML = '';
    sorted.forEach((doc, index) => {
      const meta = doc.data || {};
      const title = escapeHtml(meta.title || doc.slug);
      const category = escapeHtml(meta.category || 'Blog');
      const excerpt = escapeHtml((meta.excerpt || stripMarkdown(doc.body).slice(0, 170)).trim());
      const date = meta.date || '2026-01-01';
      const dateObj = new Date(date);
      const prettyDate = Number.isNaN(dateObj.getTime())
        ? date
        : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const card = document.createElement('article');
      card.className = `blog-card reveal ${getDelayClass(index)}`;
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'article');
      card.innerHTML = `
        <div class="blog-card__meta">
          <span class="blog-card__category">${category}</span>
          <time class="blog-card__date" datetime="${date}">${prettyDate}</time>
        </div>
        <h3 class="blog-card__title">${title}</h3>
        <p class="blog-card__excerpt">${excerpt}</p>
        <div class="blog-card__read-more" aria-hidden="true">
          Read more
          ${arrowIcon}
        </div>
      `;
      grid.appendChild(card);
    });

    observeRevealElements(grid);
  }

  async function loadCmsContent() {
    try {
      const [projectDocs, blogDocs] = await Promise.all([
        fetchMarkdownCollection('content/projects', LOCAL_MANIFESTS.projects),
        fetchMarkdownCollection('content/blog', LOCAL_MANIFESTS.blog)
      ]);

      renderProjects(projectDocs);
      renderBlogPosts(blogDocs);
    } catch (error) {
      const projectsGrid = document.getElementById('projects-grid');
      const blogGrid = document.getElementById('blog-grid');
      if (projectsGrid) projectsGrid.innerHTML = '<p class="content-empty reveal">Unable to load projects.</p>';
      if (blogGrid) blogGrid.innerHTML = '<p class="content-empty reveal">Unable to load blog posts.</p>';
      observeRevealElements(document.body);
      console.error(error);
    }
  }

  async function loadProfileSettings() {
    const avatar = document.getElementById('profile-avatar');
    if (!avatar) return;

    const fallbackSrc = avatar.getAttribute('data-fallback-src') || avatar.getAttribute('src') || '';
    const fallbackAlt = avatar.getAttribute('data-fallback-alt') || avatar.getAttribute('alt') || 'Profile image';

    const applyFallback = () => {
      avatar.src = fallbackSrc;
      avatar.alt = fallbackAlt;
    };

    try {
      const response = await fetchWithTimeout('/content/settings/profile.md', { cache: 'no-store' }, 8000);
      if (!response.ok) {
        applyFallback();
        return;
      }

      const markdown = await response.text();
      const parsed = parseMarkdownFile(markdown);
      const profileImage = safeUrl(parsed.data?.profile_image || '', '');
      const profileAlt = String(parsed.data?.profile_image_alt || '').trim();
      const cacheKey = simpleHash(markdown);

      avatar.src = profileImage ? withCacheKey(profileImage, cacheKey) : fallbackSrc;
      avatar.alt = profileAlt || fallbackAlt;
      avatar.onerror = applyFallback;
    } catch {
      applyFallback();
    }
  }

  /* ── Navbar: scroll state ──────────────────────────────────── */
  const navbar = document.querySelector('.navbar');

  function handleNavbarScroll() {
    if (window.scrollY > 48) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll(); // run once on load


  /* ── Navbar: active link highlight on scroll ──────────────── */
  const sections   = Array.from(document.querySelectorAll('section[id]'));
  const navLinks   = Array.from(document.querySelectorAll('.navbar__link'));
  const navMenuLinks = Array.from(document.querySelectorAll('.navbar__menu a'));

  const activeSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('id');
        navLinks.forEach((link) => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${id}`);
        });
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );

  sections.forEach((s) => activeSectionObserver.observe(s));


  /* ── Mobile menu ───────────────────────────────────────────── */
  const hamburger = document.querySelector('.navbar__hamburger');
  const navMenu   = document.querySelector('.navbar__menu');

  hamburger?.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on link click
  navMenuLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navMenu?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (
      navMenu?.classList.contains('open') &&
      !navbar.contains(e.target)
    ) {
      navMenu.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    }
  });


  /* ── Smooth scroll for anchor links ───────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetSelector = this.getAttribute('href');
      if (targetSelector === '#') return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      e.preventDefault();
      const navHeight = navbar?.offsetHeight ?? 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });


  /* ── Scroll reveal (IntersectionObserver) ─────────────────── */
  createRevealObserver();
  observeRevealElements(document.body);

  /* ── CMS profile settings ──────────────────────────────────── */
  loadProfileSettings();

  /* ── CMS content from Markdown files ───────────────────────── */
  loadCmsContent();


  /* ── Cursor glow (desktop only) ───────────────────────────── */
  const cursorGlow = document.querySelector('.cursor-glow');

  if (cursorGlow && window.matchMedia('(pointer: fine)').matches) {
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    }, { passive: true });

    function animateGlow() {
      // Smooth lerp toward cursor
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      cursorGlow.style.left = currentX + 'px';
      cursorGlow.style.top  = currentY + 'px';
      requestAnimationFrame(animateGlow);
    }

    animateGlow();

    // Fade out when mouse leaves the window
    document.addEventListener('mouseleave', () => {
      cursorGlow.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursorGlow.style.opacity = '1';
    });
  }


  /* ── Footer year ───────────────────────────────────────────── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();


  /* ── Keyboard: close mobile menu on Escape ────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu?.classList.contains('open')) {
      navMenu.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
      hamburger?.focus();
    }
  });

})();
