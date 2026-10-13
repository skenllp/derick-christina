/* ==========================================================
   Derick & Christina — Wedding Invitation
   Opening video · countdown · scroll reveals · RSVP
   ========================================================== */
(() => {
  'use strict';

  /* ---------- Configuration ---------- */
  const CONFIG = {
    // Wedding start: 9 January 2027, 2:30 PM IST
    weddingDate: '2027-01-09T14:30:00+05:30',

    // RSVP backend. Paste the URL that should receive RSVP submissions.
    // The form POSTs JSON: { name, attending, guests, note, submittedAt }
    // The endpoint must allow cross-origin requests (CORS) and answer with a 2xx status.
    // While this is empty, the form validates but reports that RSVPs can't be sent yet.
    rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbzckAZzovUmCoy7Zy9jiJIo7I_o-nGvoELvffhtH2oCi0w9C73WGZUnFOXbc3a7cLQv/exec',
    rsvpTimeoutMs: 15000,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Opening video → main invitation ---------- */
  function initOpening(music) {
    const root = document.documentElement;
    const opening = $('#opening');
    const stage = $('#opening-stage');
    const video = $('#opening-video');
    const openBtn = $('#open-btn');
    const skipBtn = $('#skip-btn');
    const main = $('#invitation');
    if (!opening || !openBtn || !main) return;

    const HOLD_MS = 900;          // linger on the final invitation frame
    const STALL_MS = 12000;       // give up if the video makes no progress
    const instant = reducedMotion.matches;

    // Keep the invitation out of reach (tab order, screen readers) until opened.
    main.inert = true;

    let started = false;
    let finished = false;
    let holdTimer = null;
    let watchdog = null;
    let lastTime = -1;
    let lastProgressAt = 0;
    let videoFailed = false;

    if (video) {
      video.muted = true;            // iOS needs the property, not just the attribute
      video.defaultMuted = true;
      video.loop = false;
      video.controls = false;
      video.addEventListener('error', () => { videoFailed = true; if (started) finish(true); }, true);
      const source = video.querySelector('source');
      if (source) source.addEventListener('error', () => { videoFailed = true; if (started) finish(true); });
    }

    /* Reveal the main invitation and enable scrolling */
    function finish(immediate) {
      if (finished) return;
      finished = true;
      window.clearTimeout(holdTimer);
      window.clearInterval(watchdog);
      if (video) video.pause();

      const quick = immediate || instant;
      root.classList.add('is-open');
      root.classList.remove('is-locked');
      main.inert = false;

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      main.focus({ preventScroll: true });

      window.setTimeout(initReveal, quick ? 0 : 500);
      window.setTimeout(() => { opening.hidden = true; }, quick ? 0 : 2000);
    }

    /* Video reached its last frame: hold it briefly, then transition */
    function onEnded() {
      if (finished) return;
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => finish(false), HOLD_MS);
    }

    function startOpening() {
      if (started) return;
      started = true;

      // Must run directly inside the tap handler or mobile browsers block audio.
      music.start();

      openBtn.disabled = true;
      stage.classList.add('is-playing');
      root.classList.add('is-playing');

      // Reduced motion, missing video or failed load: go straight in.
      if (!video || instant || videoFailed) { finish(true); return; }

      video.addEventListener('ended', onEnded, { once: true });
      // Fallback for browsers that skip "ended" on the last frame
      video.addEventListener('timeupdate', () => {
        if (video.duration && video.currentTime >= video.duration - 0.05) onEnded();
      });

      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => finish(true)); // blocked or unsupported: don't trap the guest
      }

      // Safety net: if playback stalls, let the guest in rather than leave them waiting.
      lastProgressAt = Date.now();
      watchdog = window.setInterval(() => {
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          lastProgressAt = Date.now();
        } else if (!video.ended && Date.now() - lastProgressAt > STALL_MS) {
          finish(true);
        }
      }, 1000);
    }

    openBtn.addEventListener('click', startOpening);

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (!started) {
          started = true;
          music.start();   // a tap is a valid gesture; the toggle lets guests mute
        }
        finish(true);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !finished) skipBtn && skipBtn.click();
    });
  }

  /* ---------- Background music ---------- */
  function initMusic() {
    const audio = $('#bgm');
    const button = $('#music-toggle');
    if (!audio || !button) return { start() {} };

    const TARGET_VOLUME = 0.5;
    let fadeTimer = null;
    let pausedByTab = false;

    function render() {
      const playing = !audio.paused;
      button.classList.toggle('is-playing', playing);
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? 'Mute music' : 'Play music');
    }

    function fadeIn() {
      window.clearInterval(fadeTimer);
      audio.volume = 0;
      fadeTimer = window.setInterval(() => {
        audio.volume = Math.min(TARGET_VOLUME, audio.volume + 0.05);
        if (audio.volume >= TARGET_VOLUME) window.clearInterval(fadeTimer);
      }, 150);
    }

    function play() {
      const attempt = audio.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(fadeIn).catch(render); // blocked or failed: leave the button in "off" state
      }
    }

    audio.addEventListener('play', render);
    audio.addEventListener('pause', render);

    button.addEventListener('click', () => {
      pausedByTab = false;
      if (audio.paused) {
        play();
      } else {
        audio.pause();
      }
    });

    // Be polite: pause when the guest switches tabs, resume when they return.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !audio.paused) {
        pausedByTab = true;
        audio.pause();
      } else if (!document.hidden && pausedByTab) {
        pausedByTab = false;
        audio.play().catch(render);
      }
    });

    render();
    return { start: play };
  }

  /* ---------- Scroll reveals ---------- */
  function initReveal() {
    const items = $$('.reveal');

    if (!('IntersectionObserver' in window) || reducedMotion.matches) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Countdown ---------- */
  function initCountdown() {
    const target = new Date(CONFIG.weddingDate).getTime();
    const grid = $('#countdown');
    const done = $('#countdown-done');
    if (!grid || !done || Number.isNaN(target)) return;

    const units = {
      days: $('[data-unit="days"]', grid),
      hours: $('[data-unit="hours"]', grid),
      minutes: $('[data-unit="minutes"]', grid),
      seconds: $('[data-unit="seconds"]', grid),
    };
    const pad = (n) => String(n).padStart(2, '0');
    let timer = null;

    function tick() {
      const diff = target - Date.now();

      if (diff <= 0) {
        grid.hidden = true;
        done.hidden = false;
        if (timer) window.clearInterval(timer);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      units.days.textContent = pad(Math.floor(totalSeconds / 86400));
      units.hours.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
      units.minutes.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
      units.seconds.textContent = pad(totalSeconds % 60);
    }

    tick();
    timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
  }

  /* ---------- RSVP ---------- */

  // Decide from the endpoint's reply whether the RSVP was really stored.
  // - Non-2xx is handled by the caller.
  // - An HTML body is a Google error / sign-in page, never a saved RSVP.
  // - JSON or text carrying an explicit failure marker is a failure.
  // - Anything else that arrived with a 2xx is accepted ({result:"success"}, {ok:true}, "OK", ...).
  function isSaveConfirmed(raw) {
    const text = String(raw || '').trim();
    if (/^<(!doctype|html|head|body)/i.test(text)) return false;

    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* plain text reply */ }

    if (data && typeof data === 'object') {
      const verdict = String(data.result || data.status || '').toLowerCase();
      if (data.success === false || data.ok === false || data.error) return false;
      if (/^(error|fail|failed|failure)$/.test(verdict)) return false;
      return true;
    }
    return !/\b(error|exception|failed|failure)\b/i.test(text);
  }

  function initRsvp() {
    const form = $('#rsvp-form');
    if (!form) return;

    const nameInput = $('#rsvp-name');
    const guestsField = $('#rsvp-guests-field');
    const guestsSelect = $('#rsvp-guests');
    const noteInput = $('#rsvp-note');
    const honeypot = $('#rsvp-website');
    const choices = $$('.choice', form);
    const submitBtn = $('#rsvp-submit');
    const statusEl = $('#rsvp-status');
    const thanks = $('#rsvp-thanks');
    const thanksSub = $('#rsvp-thanks-sub');
    const errors = {
      name: $('#rsvp-name-error'),
      attend: $('#rsvp-attend-error'),
      guests: $('#rsvp-guests-error'),
    };

    let attending = null; // 'accept' | 'decline' | null
    let submitting = false;

    /* Attendance toggle */
    choices.forEach((btn) => {
      btn.addEventListener('click', () => {
        attending = btn.dataset.value;
        choices.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        guestsField.hidden = attending !== 'accept';
        setError('attend', '');
        setStatus('');
      });
    });

    nameInput.addEventListener('input', () => setError('name', ''));

    function setError(key, message) {
      const el = errors[key];
      if (!el) return;
      el.textContent = message;
      el.hidden = !message;
      if (key === 'name') nameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (key === 'guests') guestsSelect.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function setStatus(message) {
      statusEl.textContent = message;
      statusEl.hidden = !message;
    }

    function validate() {
      let firstInvalid = null;
      const name = nameInput.value.trim();

      if (name.length < 2 || !/\p{L}/u.test(name)) {
        setError('name', 'Please enter your full name.');
        firstInvalid = firstInvalid || nameInput;
      } else if (name.length > 80) {
        setError('name', 'Please keep your name under 80 characters.');
        firstInvalid = firstInvalid || nameInput;
      }

      if (!attending) {
        setError('attend', 'Please let us know if you can join us.');
        firstInvalid = firstInvalid || choices[0];
      }

      if (attending === 'accept') {
        const guests = Number(guestsSelect.value);
        if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
          setError('guests', 'Please choose between 1 and 10 guests.');
          firstInvalid = firstInvalid || guestsSelect;
        }
      }

      if (firstInvalid) firstInvalid.focus();
      return !firstInvalid;
    }

    function showThanks() {
      thanksSub.textContent = attending === 'accept'
        ? 'We look forward to celebrating with you.'
        : 'You will be in our thoughts and prayers on the day.';
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus({ preventScroll: true });
      thanks.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;

      // Bots fill hidden fields; people never see this one. Ignore quietly.
      if (honeypot.value) return;

      ['name', 'attend', 'guests'].forEach((key) => setError(key, ''));
      setStatus('');

      if (!validate()) return;

      // Never claim success when nothing is connected to receive the RSVP.
      if (!CONFIG.rsvpEndpoint) {
        setStatus('RSVPs cannot be sent from this page yet. Please confirm your presence with the family directly.');
        return;
      }

      const payload = {
        name: nameInput.value.trim(),
        attending,
        guests: attending === 'accept' ? Number(guestsSelect.value) : 0,
        note: noteInput.value.trim(),
        submittedAt: new Date().toISOString(),
      };

      submitting = true;
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CONFIG.rsvpTimeoutMs);

      try {
        const response = await fetch(CONFIG.rsvpEndpoint, {
          method: 'POST',
          // text/plain avoids a CORS preflight, which Google Apps Script cannot answer.
          // The body is still JSON; the server parses it.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Apps Script answers 200 even when it fails, so read the body before celebrating.
        if (!isSaveConfirmed(await response.text())) throw new Error('Not confirmed');
        showThanks();
      } catch (error) {
        setStatus('We could not send your RSVP. Please check your connection and try again.');
      } finally {
        window.clearTimeout(timeout);
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  /* ---------- Init ---------- */
  initOpening(initMusic());
  initCountdown();
  initRsvp();
})();
